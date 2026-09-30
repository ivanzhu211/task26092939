import { ComponentNode, TreeOperation } from './types';
/**
 * 生成把旧快照转换为新快照的结构编辑方案。
 *
 * 移动次数全局最少：
 * - 父组件发生变化的保留组件必须移动；
 * - 父组件未变的同层组件中，相对顺序与旧快照不一致（不在 LIS 中）的必须移动；
 * 二者之和即为下界，本方案按此集合每个组件恰好移动一次，达到该下界。
 *
 * 操作顺序：按新快照先序遍历发出 add / move（父先于子、兄先于弟），
 * 保证每一步都是合法单根树；remove 全部放在最后。
 * 不会修改传入的两份快照。
 */
export declare function diffTrees(oldRoot: ComponentNode, newRoot: ComponentNode): TreeOperation[];
