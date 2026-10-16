// Upstream tickers we pass into URLs: letters, digits and the punctuation Yahoo uses (^GSPC, BTC-USD, EURUSD=X).
export const YAHOO_TICKER = /^[A-Za-z0-9.^=-]{1,20}$/;
