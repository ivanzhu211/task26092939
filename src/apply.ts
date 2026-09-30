import { ComponentNode, Operation } from './types';
import { buildTreeModel, deepCloneTree, TreeModel } from './tree';

function childrenArrayOf(node: ComponentNode): ComponentNode[] {
  if (node.children === undefined) {
    node.children = [];
  }
  return node.children;
}

function subtreeSize(model: TreeModel, id: string): number {
  let size = 1;
  for (const childId of model.childrenOf.get(id)!) {
    size += subtreeSize(model, childId);
  }
  return size;
}

function applyOne(root: ComponentNode, model: TreeModel, op: Operation): number {
  switch (op.type) {
    case 'add': {
      if (model.nodes.has(op.id)) {
        throw new Error(`add: 组件 id 已存在: ${op.id}`);
      }
      const parent = model.nodes.get(op.parentId);
      if (!parent) {
        throw new Error(`add: 父组件不存在: ${op.parentId}`);
      }
      const nodeData = op.node as ComponentNode;
      if (Array.isArray(nodeData.children) && nodeData.children.length > 0) {
        throw new Error(`add: 新增组件不能携带子组件: ${op.id}`);
      }
      const siblings = childrenArrayOf(parent);
      if (op.index < 0 || op.index > siblings.length) {
        throw new Error(`add: 插入位置越界: ${op.index}`);
      }
      const fresh: ComponentNode = { ...nodeData, id: op.id };
      delete fresh.children;
      siblings.splice(op.index, 0, fresh);
      return 1;
    }
    case 'remove': {
      if (op.id === root.id) {
        throw new Error('remove: 根组件不能删除');
      }
      if (!model.nodes.has(op.id)) {
        throw new Error(`remove: 组件不存在: ${op.id}`);
      }
      const parentId = model.parentOf.get(op.id)!;
      const parent = model.nodes.get(parentId)!;
      const siblings = parent.children!;
      siblings.splice(siblings.findIndex((n) => n.id === op.id), 1);
      return -subtreeSize(model, op.id);
    }
    case 'move': {
      if (op.id === root.id) {
        throw new Error('move: 根组件不能移动');
      }
      const node = model.nodes.get(op.id);
      if (!node) {
        throw new Error(`move: 组件不存在: ${op.id}`);
      }
      const parent = model.nodes.get(op.parentId);
      if (!parent) {
        throw new Error(`move: 目标父组件不存在: ${op.parentId}`);
      }
      // 不能移到自己或当前后代的下面
      let cursor: string | undefined = op.parentId;
      while (cursor !== undefined) {
        if (cursor === op.id) {
          throw new Error(`move: 不能把组件移到自己或后代的下面: ${op.id}`);
        }
        cursor = model.parentOf.get(cursor);
      }
      const oldParent = model.nodes.get(model.parentOf.get(op.id)!)!;
      const oldSiblings = oldParent.children!;
      oldSiblings.splice(
        oldSiblings.findIndex((n) => n.id === op.id),
        1,
      );
      const siblings = childrenArrayOf(parent);
      if (op.index < 0 || op.index > siblings.length) {
        throw new Error(`move: 插入位置越界: ${op.index}`);
      }
      siblings.splice(op.index, 0, node);
      return 0;
    }
  }
}

/**
 * 依次重放编辑方案，返回结果树。
 * 不会修改传入的 baseTree；每个操作执行后都会校验仍是合法单根树，
 * 非法操作（重复 id、环、脱离根的组件、目标不存在等）会抛出 Error。
 */
export function applyOperations(
  baseTree: ComponentNode,
  operations: Operation[],
): ComponentNode {
  const root = deepCloneTree(baseTree);
  let model = buildTreeModel(root);
  for (const op of operations) {
    const delta = applyOne(root, model, op);
    const expected = model.nodes.size + delta;
    model = buildTreeModel(root);
    if (model.nodes.size !== expected) {
      throw new Error(`操作 ${op.type}(${op.id}) 后树不再合法`);
    }
  }
  return root;
}
