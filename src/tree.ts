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
export function deepCloneTree(root: ComponentNode): ComponentNode {
  const clone: ComponentNode = { ...root };
  if (root.children !== undefined) {
    clone.children = root.children.map(deepCloneTree);
  }
  return clone;
}

/**
 * 校验并索引一棵树。
 * 校验失败（根非法、id 非字符串、id 重复）时抛出 Error。
 */
export function buildTreeModel(root: ComponentNode): TreeModel {
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('组件树根节点必须是对象');
  }
  const nodes = new Map<string, ComponentNode>();
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const depthOf = new Map<string, number>();

  const visit = (
    node: ComponentNode,
    parentId: string | null,
    depth: number,
  ): void => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error('组件节点必须是对象');
    }
    if (typeof node.id !== 'string' || node.id.length === 0) {
      throw new Error('组件节点缺少合法的字符串 id');
    }
    if (nodes.has(node.id)) {
      throw new Error(`组件 id 重复: ${node.id}`);
    }
    nodes.set(node.id, node);
    if (parentId !== null) {
      parentOf.set(node.id, parentId);
    }
    depthOf.set(node.id, depth);

    const rawChildren = node.children;
    const childIds: string[] = [];
    childrenOf.set(node.id, childIds);
    if (rawChildren === undefined) {
      return;
    }
    if (!Array.isArray(rawChildren)) {
      throw new Error(`组件 ${node.id} 的 children 必须是数组`);
    }
    for (const child of rawChildren) {
      visit(child, node.id, depth + 1);
      childIds.push(child.id);
    }
  };
  visit(root, null, 0);

  return { root, nodes, parentOf, childrenOf, depthOf };
}
