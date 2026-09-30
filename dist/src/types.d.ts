/**
 * 页面组件树节点。除 id / children 外允许携带任意业务字段，
 * 这些字段在 diff 与重放过程中会被原样保留（深拷贝）。
 */
export interface ComponentNode {
    id: string;
    children?: ComponentNode[];
    [key: string]: unknown;
}
/** 新增：在 parentId 下 index 处创建一个新组件（不含子组件）。 */
export interface AddOperation {
    type: 'add';
    /** 新快照独有的组件 id */
    id: string;
    parentId: string;
    index: number;
    /** 新组件自身的数据（已剥离 children 的深拷贝） */
    node: Omit<ComponentNode, 'children'> & {
        id: string;
    };
}
/** 删除：移除该组件及其当前整棵子树。 */
export interface RemoveOperation {
    type: 'remove';
    id: string;
}
/** 移动：把组件及其当前整棵子树放到 parentId 下的 index 处。 */
export interface MoveOperation {
    type: 'move';
    id: string;
    parentId: string;
    index: number;
}
export declare type Operation = AddOperation | RemoveOperation | MoveOperation;
