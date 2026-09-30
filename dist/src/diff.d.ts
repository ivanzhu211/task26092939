import { ComponentNode, Operation } from './types';
/**
 * 计算把 oldTree 转换为 newTree 的结构编辑方案。
 *
 * 方案只包含 add / remove / move 三类操作，且在所有可行方案中
 * move 次数达到全局最少（add / remove 不计入）。
 * 传入的两份快照不会被修改。
 */
export declare function diffComponentTrees(oldTree: ComponentNode, newTree: ComponentNode): Operation[];
