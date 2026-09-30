import { ComponentNode, TreeOperation } from './types';
/** 深拷贝一棵组件树（输入为 JSON，直接使用结构化克隆）。 */
export declare function cloneTree(root: ComponentNode): ComponentNode;
/** 在树上原地执行单个操作；操作非法时抛出异常，树保持未修改。 */
export declare function applyOperation(root: ComponentNode, op: TreeOperation): ComponentNode;
/**
 * 按方案依次修改旧快照，返回重放后的新树。
 * 不会修改调用方传入的旧快照。
 */
export declare function applyOperations(oldRoot: ComponentNode, ops: readonly TreeOperation[]): ComponentNode;
