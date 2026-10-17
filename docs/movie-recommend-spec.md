# 随机电影推荐功能：设计规格（基于 Trakt + TMDB）

> 实现在 admin 的 `backend/app/plugin/module_bot/movie/recommend.py`，Discord 界面在 bot 的 `services/movies/picks.js`。这是一个"推荐池 + 加权随机抽取"系统，有三种模式：
> **舒适区**（猜你喜欢）、**探索区**（盲区里的高分片和经典系列）、**桥接区**（盲区类型 × 你喜欢的导演或演员）。
>
> 实际实现与本文的差异（2026-10-18）：
>
> - Trakt 授权沿用网站的 OAuth（PKCE），不用 device code flow；没有 token 的档案不能用（admin 回 403 `traktRequired`）。
> - 没有「不感兴趣」按钮；模式比例的 bandit 用「想看」当正向、「换一部」当负向。
> - 每天 3 次（第一次 + 两次「换一部」），台北时间日界。
> - 「看过了」会先查 Trakt 有没有评分：有就直接标记看过；没有就让用户当场选 1–10 分，再一起写评分和观看记录。
> - 候选池在第一次请求时建好（而不是每天预计算），之后沿用一天，或 `last_activities` 变了就重建。
> - 盲区第一版只做类型和年代，国家 / 语言盲区和策划片单还没做。

---

## 一、数据来源

| 用途                                       | 来源                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 看过的电影（含观看次数 `plays`）           | Trakt `GET /sync/watched/movies?extended=full`                                                                                |
| 评分                                       | Trakt `GET /sync/ratings/movies`                                                                                              |
| 想看列表                                   | Trakt `GET /sync/watchlist/movies`                                                                                            |
| 隐藏列表                                   | Trakt `GET /users/hidden/recommendations?type=movie`                                                                          |
| 数据是否有变化                             | Trakt `GET /sync/last_activities`                                                                                             |
| Trakt 自带个性化推荐                       | Trakt `GET /recommendations/movies?ignore_collected=true&ignore_watchlisted=true&limit=100`                                   |
| 相似电影                                   | Trakt `GET /movies/{id}/related?limit=20`                                                                                     |
| 按类型 / 评分 / 年代筛选                   | Trakt `GET /movies/popular` 加 `genres`、`ratings`（百分制，如 `75-100`）、`years`、`languages`、`countries`、`runtimes` 参数 |
| 电影详情、系列、导演、演员、海报、中文标题 | TMDB `GET /movie/{id}?append_to_response=credits&language=zh-TW`、`GET /collection/{id}`、`GET /discover/movie`               |

Trakt 每部电影都带 `ids.tmdb`，两边直接关联。TMDB id 到 Trakt id 的反查用 `GET /search/tmdb/{id}?type=movie`，结果永久缓存。

**中文显示：** Trakt 只有英文标题和简介。TMDB 请求带 `language=zh-TW`（或 `zh-CN`）可拿到中文标题和简介，没有中文时 TMDB 会回退到英文，不需要额外处理。

---

## 二、排除规则

每次推荐前先构造排除集合 `excluded`，命中的候选一律不出现：

1. **所有看过的**（不只是评分过的，很多人看了不打分）
2. **评分过的**
3. **隐藏列表**里的
4. **最近 30 天内已推荐过的**（本地记录）
5. **未上映的**：TMDB discover 加 `primary_release_date.lte=今天`，Trakt 检查 `released` 字段不为空且不晚于今天
6. **负向信号传播**（见 3.1）：用户打低分的电影，其所属系列的其他作品，以及以它为种子召回的 related 结果，全部排除

**想看列表不排除**，反而加分。"你自己标过想看"本身是很好的推荐理由，展示时标注"已在你的想看列表"。

---

## 三、模式 A：舒适区（猜你喜欢）

### 3.1 口味画像

**每部看过电影的权重 `w`：**

```
若有评分：   w = (评分 - 用户自己的平均评分)          # 以用户均分为中心，不用固定的 5.5
若无评分：   w = +0.5                                  # 看了就是弱正向
若 plays >= 2：w = max(w, +2.0)                        # 重看是强正向，覆盖上面的值
```

> 为什么不固定基线：很多人打分集中在 7 到 9，用 5.5 做基线会让所有片子都是正向，画像失去区分度。
> 用户评分少于 5 部时，均分用 7.0 兜底。

**时间衰减：** 只对**负向**权重衰减，正向不衰减。半衰期两年。

```
若 w < 0：w = w × 0.5 ^ (距今年数 / 2)
```

电影口味变化比音乐慢，负面印象会淡，但喜欢过的片子通常一直喜欢。

**负向信号定义：** `w <= -1.5` 的电影记为 `disliked`。它们用于排除规则第 6 条。

**汇总偏好分：** 把每部电影的 `w` 累加到它的各个维度上，得到：

- `genrePref[类型]`
- `directorPref[导演]`、`actorPref[演员]`（只取演员表前 5 位）
- `decadePref[年代]`、`countryPref[国家]`、`languagePref[语言]`

演职员数据来自 TMDB credits。**只对 `w >= 1.5` 或 `plays >= 2` 的电影拉 credits**，用 `append_to_response=credits` 一次拿完，避免对一千部历史发一千次请求。

每组偏好分做 L2 归一化，方便后面算相似度。

### 3.2 召回候选

三路召回，取并集，记录每部候选的**来源**和**种子**（用于写推荐理由）：

| 来源        | 做法                                                                                                       | 数量        |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| `trakt_rec` | Trakt `/recommendations/movies`                                                                            | 最多 100    |
| `related`   | 从 `w >= 1.5` 的电影里随机取 5 部做种子，每部 `/movies/{id}/related`                                       | 约 100      |
| `director`  | `directorPref` 前 3 名导演的其他作品（TMDB `/discover/movie?with_crew=`，或 `/person/{id}/movie_credits`） | 每人最多 20 |

### 3.3 打分

```
score = 0.40 × 类型相似度        # 候选的 genre 向量 与 genrePref 的余弦相似
      + 0.25 × 演职员命中         # directorPref 或 actorPref 命中的最高值，归一到 0..1
      + 0.20 × 大众评分           # 贝叶斯平均，归一到 0..1
      + 0.15 × 想看加分           # 在想看列表里为 1，否则 0
```

**贝叶斯平均**（IMDb Top 250 公式），防止只有 20 票的 9.5 分电影排到前面：

```
bayes = (v / (v + m)) × R + (m / (v + m)) × C
  R = 该片平均分
  v = 该片票数
  m = 最低票数门槛，取 1000
  C = 全库平均分，取 6.5（或从 Trakt popular 前 1000 部算一次）
归一：(bayes - 5) / 4，clamp 到 0..1
```

Trakt 和 TMDB 都有评分和票数，优先用 Trakt 的，缺失时用 TMDB 的。

### 3.4 随机抽取

不取第一名，用 **softmax 按温度加权抽样**：

```
P(i) ∝ exp(score_i / T)
```

**分数在 0 到 1 之间时，T 必须很小才有区分度。** 默认 `T = 0.15`。做"随机度"滑块时范围取 `0.05`（几乎总是最好的那几部）到 `0.5`（接近均匀随机），不要让 T 到 1。

**多样性约束：**

- 每个 `related` 种子最多贡献 2 部进入最终抽样池
- 同一位导演最多 2 部
- 同一次会话里按"换一部"时，已经展示过的不再出现

---

## 四、模式 B：探索区（没看过的类型、高分、经典）

### 4.1 找盲区

**要按全局基率归一化，不能按绝对数量。** 西部片、战争片、音乐片本来就少，按绝对数量找盲区，每次都会抓到这几个。

```
盲区分 = 用户该类型占比 ÷ 全库该类型占比
```

- 用户占比：看过的电影里含该类型的比例（TMDB 是多标签，一部恐怖喜剧两边都算）
- 全库占比：用 TMDB discover 按 `vote_count.gte=1000` 取前 500 部算一次，缓存 30 天
- `盲区分 < 0.3` 的类型是盲区；都不满足就取最低的 4 个

同样的方法用在**国家 / 语言**（例如从没看过伊朗电影）和**年代**（例如没看过 70 年代以前的）。

### 4.2 盲区里只推"入门级经典"

一个用户没看过的类型，第一部一定要是该类型里**口碑最稳、门槛最低**的。所以按投票数排，不是只按评分。

**类型盲区：**

```
TMDB /discover/movie
  ?with_genres={id}
  &vote_count.gte=3000
  &vote_average.gte=7.5
  &primary_release_date.lte={今天}
  &sort_by=vote_count.desc
  &language=zh-TW
  取前 3 页
```

**国家 / 语言盲区：** `vote_count.gte=3000` 会把非英语片几乎全部筛掉，必须降门槛。

```
  &with_original_language={lang}
  &vote_count.gte=400
  &vote_average.gte=7.3
```

**年代盲区：** 加 `primary_release_year` 范围，`vote_count.gte=1500`。

**可选补充池：** 策划片单（Trakt 上的 IMDb Top 250、Criterion、Sight & Sound 等公开 list），用 `GET /users/{user}/lists/{slug}/items/movies` 拉取。**具体 slug 实现时到 trakt.tv 搜索确认后填进配置，不要猜。**

### 4.3 经典系列

1. 把探索池里每部候选的 `belongs_to_collection` 收集起来
2. 对每个系列调 `GET /collection/{id}`，拿到所有成员
3. **按上映日期排序取第一部**作为入口。collection 里会混进重制版和外传，按日期排能避开大多数
4. 要求这个系列满足：
   - 用户**一部都没看过**
   - 系列贝叶斯平均分 >= 7.0，总票数 >= 5000
   - **入口那一部本身的贝叶斯分 >= 7.0**。有些系列第一部不好看，这种直接跳过整个系列，不要推
   - 系列里没有任何一部在 `disliked` 里（负向传播）
5. 符合条件的系列第一部加 `franchiseStart = 1`

**续集提醒（额外功能）：** 用户看了某系列的第 1 部、没看第 2 部，且第 1 部评分 `w >= 1`，可以作为独立的一路召回："你看过《X》，它的续集还没看"。这路**不走盲区逻辑**，只在用户明确要求"续集"时或作为低比例彩蛋出现。

### 4.4 打分

```
score = 0.40 × 大众评分(贝叶斯)       # 同 3.3，m 取 2000
      + 0.25 × 票数                    # log10(votes) / 6，clamp 0..1；经典片票数高
      + 0.20 × 盲区程度                # 1 - 盲区分，越没看过越高
      + 0.15 × franchiseStart          # 系列第一部为 1，否则 0
```

抽样同 3.4，`T = 0.15`，并约束：同一系列只出现 1 部，同一类型最多 2 部。

---

## 五、模式 C：桥接区

推荐**盲区类型**里、但和**用户喜欢的导演或演员有关**的电影。

例：用户很喜欢诺兰，但从没看过战争片 → 推《敦刻尔克》。既是新类型，成功率又高，通常体验最好。

**做法：**

1. 取 `directorPref` 前 5 名和 `actorPref` 前 10 名
2. 对每个人用 TMDB `/person/{id}/movie_credits` 拉作品
3. 保留**含有盲区类型**（4.1 的结果）且不在 `excluded` 里的
4. 打分：

```
score = 0.40 × 演职员偏好分（归一）
      + 0.30 × 大众评分(贝叶斯)
      + 0.30 × 盲区程度
```

5. 抽样同 3.4

桥接池经常很小，少于 3 部时本次退回舒适区。

---

## 六、整体流程

```
每次点"随机推荐":
  1. 冷启动检查：看过的电影少于 10 部 → 强制探索区，并提示"历史太少，先随机推一部经典"
  2. 掷骰子决定模式（初始比例 舒适 50% / 桥接 25% / 探索 25%，可配置）
  3. 从该模式的候选池按 softmax 加权随机抽 1 部
  4. 展示：海报 + 中文标题/简介 + 推荐理由
  5. 用户操作：想看 / 看过了 / 不感兴趣 / 换一部
```

**推荐理由模板**（按来源生成，这是随机推荐能否被接受的关键）：

| 来源           | 理由                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| related        | 你给《{种子}》打了 {分} 分，这部和它很像                                   |
| director       | 你给《{种子}》打了 {分} 分，同导演 {名字} 的作品                           |
| trakt_rec      | Trakt 根据你的历史推荐                                                     |
| watchlist 加分 | 这部在你的想看列表里躺了 {n} 个月                                          |
| 类型盲区       | 你几乎没看过{类型}片，这是该类型票数最高的几部之一（{评分} 分，{票数} 票） |
| 国家盲区       | 你没看过{国家}电影，这是最适合入门的一部                                   |
| 系列第一部     | 这是《{系列}》系列的第一部，适合入坑                                       |
| 桥接           | 你喜欢 {导演/演员}，但从没看过{类型}片，这部两样都有                       |

**用户操作对系统的影响：**

| 操作     | 立即执行                                                     |
| -------- | ------------------------------------------------------------ |
| 想看     | 写 Trakt watchlist；**当场从所有候选池移除**（不等隔天重算） |
| 看过了   | 写 Trakt history；当场移除；画像标记需要重算                 |
| 不感兴趣 | 写 Trakt hidden；当场移除；记录到本地                        |
| 换一部   | 同模式再抽，排除本次会话已展示的                             |

**模式比例自适应（最简单的 bandit）：**

- 对每个模式记录"想看"次数和"不感兴趣"次数
- 每次掷骰子前，模式权重 = `初始比例 × (想看 + 1) / (想看 + 不感兴趣 + 2)`
- 归一化后再抽。这样哪个模式被接受得多，就慢慢出现得多，不需要额外基础设施

**可选参数**（三个模式通用，在召回阶段直接当过滤条件）：

- `genre`：只在该类型里找
- `decade`：年代范围
- `max_runtime`：最长片长，"今晚只想看两小时以内的"是最常见的场景

---

## 七、工程注意

- **Trakt 授权**走 device code flow（`POST /oauth/device/code` → 用户去网页输入 code → 轮询 `POST /oauth/device/token`）。token 约 3 个月过期，用 refresh_token 刷新。
- **限流**约每 5 分钟 1000 次 GET。历史、评分、电影详情、credits、collection 都要本地缓存。用 `/sync/last_activities` 的 `movies.watched_at`、`rated_at`、`watchlisted_at` 判断有没有变化，再决定要不要增量同步（`/sync/history/movies?start_at=`）。
- **候选池每天预计算一次**，三种模式各一个池，点按钮时只做抽样，响应很快。按钮操作触发的移除直接改内存里的池，不重算。
- **画像重算触发条件**：last_activities 有变化，或距上次重算超过 24 小时。
- **TMDB 全库类型占比**和 **TMDB→Trakt id 映射**是全局缓存，不按用户。
- 候选池为空的降级顺序：放宽"30 天内推过"到 7 天 → 放宽票数门槛一半 → 换模式 → 提示"暂时找不到，试试指定类型"。

---

## 附录：可调参数默认值

```
profile:
  defaultMeanRating: 7.0        # 评分少于 5 部时的均分兜底
  unratedWeight: 0.5
  rewatchWeight: 2.0
  dislikedThreshold: -1.5
  negativeHalfLifeYears: 2
  creditsMinWeight: 1.5         # 只对 w >= 此值的电影拉 credits

bayes:
  comfortM: 1000
  exploreM: 2000
  globalMean: 6.5

sampling:
  temperature: 0.15
  temperatureRange: [0.05, 0.5]
  maxPerSeed: 2
  maxPerDirector: 2
  maxPerCollection: 1
  maxPerGenre: 2

exclusion:
  noRepeatDays: 30

explore:
  blindSpotThreshold: 0.3       # 用户占比 / 全库占比
  fallbackBlindSpotCount: 4
  genre:    { voteCountGte: 3000, voteAverageGte: 7.5, pages: 3 }
  language: { voteCountGte: 400,  voteAverageGte: 7.3, pages: 3 }
  decade:   { voteCountGte: 1500, voteAverageGte: 7.3, pages: 2 }
  collection:
    minAvgBayes: 7.0
    minTotalVotes: 5000
    minFirstFilmBayes: 7.0
  classicLists: []              # [{ user, slug }]，到 trakt.tv 确认后填

modes:
  initialWeights: { comfort: 0.5, bridge: 0.25, explore: 0.25 }
  coldStartMinWatched: 10
  bridgeMinPoolSize: 3
```
