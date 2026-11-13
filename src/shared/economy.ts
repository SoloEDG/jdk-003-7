// 跨模块共享的经济/状态常量，集中在 shared 层以避免特性模块间的循环依赖。

// 欠债期间商店对每件商品收取的额外费用（每件固定加价，独立于好感折扣）
export const SHOP_DEBT_SURCHARGE = 8;

// 每道伤疤降低的最大生命
export const SCAR_HP = 8;
