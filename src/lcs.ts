/**
 * 求两个序列的最长公共子序列（保留其中一个即可）。
 * 返回出现在 result 中的元素集合之外的信息由调用方自行推导；
 * 这里直接返回一个 LCS 的元素下标（基于 b 的顺序）对应的元素值数组。
 */
export function longestCommonSubsequence<T>(a: T[], b: T[]): T[] {
  const rows = a.length;
  const cols = b.length;
  if (rows === 0 || cols === 0) {
    return [];
  }
  // dp[i][j] = LCS(a[0..i), b[0..j)) 的长度
  const dp: number[][] = [];
  for (let i = 0; i <= rows; i++) {
    dp.push(new Array<number>(cols + 1).fill(0));
  }
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const result: T[] = [];
  let i = rows;
  let j = cols;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  result.reverse();
  return result;
}
