import { ComponentNode, Operation } from './types';
/**
 * 依次重放编辑方案，返回结果树。
 * 不会修改传入的 baseTree；每个操作执行后都会校验仍是合法单根树，
 * 非法操作（重复 id、环、脱离根的组件、目标不存在等）会抛出 Error。
 */
export declare function applyOperations(baseTree: ComponentNode, operations: Operation[]): ComponentNode;
