import { ComponentNode } from './types';
/** 一棵组件树的索引化模型，便于按 id O(1) 查询。 */
export interface TreeModel {
    root: ComponentNode;
    /** id -> 节点（引用自传入树） */
    nodes: Map<string, ComponentNode>;
    /** id -> 父节点 id（根节点无此项） */
    parentOf: Map<string, string>;
    /** id -> 有序子节点 id 列表（无子节点时为空数组） */
    childrenOf: Map<string, string[]>;
    /** id -> 深度（根为 0） */
    depthOf: Map<string, number>;
}
/** 深拷贝一棵组件树。 */
export declare function deepCloneTree(root: ComponentNode): ComponentNode;
/**
 * 校验并索引一棵树。
 * 校验失败（根非法、id 非字符串、id 重复）时抛出 Error。
 */
export declare function buildTreeModel(root: ComponentNode): TreeModel;
