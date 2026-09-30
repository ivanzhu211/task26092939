/**
 * 求两个序列的最长公共子序列（保留其中一个即可）。
 * 返回出现在 result 中的元素集合之外的信息由调用方自行推导；
 * 这里直接返回一个 LCS 的元素下标（基于 b 的顺序）对应的元素值数组。
 */
export declare function longestCommonSubsequence<T>(a: T[], b: T[]): T[];
