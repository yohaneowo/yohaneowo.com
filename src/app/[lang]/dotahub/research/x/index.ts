import { baselinesModule } from "./baselines";
import { historyModule } from "./history";
import { laningModule } from "./laning";
import { farmingModule } from "./farming";
import { itemsModule } from "./items";
import { skillsModule } from "./skills";
import { fightsModule } from "./fights";
import { decisionsModule } from "./decisions";
import { visionModule } from "./vision";
import type { LabModule } from "./types";

// Every analysis module, in the order their blocks appear within a section.
export const MODULES: LabModule[] = [
  baselinesModule,
  historyModule,
  laningModule,
  farmingModule,
  itemsModule,
  skillsModule,
  fightsModule,
  decisionsModule,
  visionModule,
];
