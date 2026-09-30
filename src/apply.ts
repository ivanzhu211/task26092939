import { ComponentNode, TreeOperation } from './types';

interface Located {
  parent: ComponentNode | null;
  index: number;
  node: ComponentNode;
}

function childrenOf(node: ComponentNode): ComponentNode[] {
  if (!node.children) {
    node.children = [];
  }
  return node.children;
}

/** 在整棵树中按 id 查找节点及其父节点与下标。 */
function locate(root: ComponentNode, id: string): Located | null {
  if (root.id === id) {
    return { parent: null, index: -1, node: root };
  }
  const stack: ComponentNode[] = [root];
  while (stack.length > 0) {
    const parent = stack.pop() as ComponentNode;
    const children = parent.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.id === id) {
        return { parent, index: i, node: child };
      }
      stack.push(child);
    }
  }
  return null;
}

/** 判断 maybeDescendant 是否位于 ancestor 的子树内（不含 ancestor 本身）。 */
function isDescendant(ancestor: ComponentNode, maybeDescendant: ComponentNode): boolean {
  const stack: ComponentNode[] = [...(ancestor.children ?? [])];
  while (stack.length > 0) {
    const node = stack.pop() as ComponentNode;
    if (node === maybeDescendant) {
      return true;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return false;
}

/** 深拷贝一棵组件树（输入为 JSON，直接使用结构化克隆）。 */
export function cloneTree(root: ComponentNode): ComponentNode {
  return JSON.parse(JSON.stringify(root)) as ComponentNode;
}

/** 在树上原地执行单个操作；操作非法时抛出异常，树保持未修改。 */
export function applyOperation(root: ComponentNode, op: TreeOperation): ComponentNode {
  switch (op.type) {
    case 'add': {
      if (op.node.id !== op.id) {
        throw new Error(`add: node.id "${op.node.id}" 与操作 id "${op.id}" 不一致`);
      }
      if (locate(root, op.id) !== null) {
        throw new Error(`add: id "${op.id}" 已存在，会产生重复 id`);
      }
      if (op.node.children && op.node.children.length > 0) {
        throw new Error(`add: 新增节点 "${op.id}" 不允许携带子组件`);
      }
      const target = locate(root, op.parentId);
      if (target === null) {
        throw new Error(`add: 父组件 "${op.parentId}" 不存在`);
      }
      const siblings = childrenOf(target.node);
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > siblings.length) {
        throw new Error(`add: 下标 ${op.index} 超出范围 [0, ${siblings.length}]`);
      }
      siblings.splice(op.index, 0, cloneTree(op.node));
      return root;
    }
    case 'remove': {
      const target = locate(root, op.id);
      if (target === null) {
        throw new Error(`remove: 组件 "${op.id}" 不存在`);
      }
      if (target.parent === null) {
        throw new Error('remove: 不允许删除根组件');
      }
      target.parent.children!.splice(target.index, 1);
      return root;
    }
    case 'move': {
      const target = locate(root, op.id);
      if (target === null) {
        throw new Error(`move: 组件 "${op.id}" 不存在`);
      }
      if (target.parent === null) {
        throw new Error('move: 不允许移动根组件');
      }
      const newParent = locate(root, op.parentId);
      if (newParent === null) {
        throw new Error(`move: 父组件 "${op.parentId}" 不存在`);
      }
      if (newParent.node === target.node || isDescendant(target.node, newParent.node)) {
        throw new Error(`move: 不能把组件 "${op.id}" 移动到自己或自己的后代下面`);
      }
      // 先从当前位置摘下，再按摘下后的下标插入。
      target.parent.children!.splice(target.index, 1);
      const siblings = childrenOf(newParent.node);
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > siblings.length) {
        throw new Error(`move: 下标 ${op.index} 超出范围 [0, ${siblings.length}]`);
      }
      siblings.splice(op.index, 0, target.node);
      return root;
    }
  }
}

/**
 * 按方案依次修改旧快照，返回重放后的新树。
 * 不会修改调用方传入的旧快照。
 */
export function applyOperations(
  oldRoot: ComponentNode,
  ops: readonly TreeOperation[],
): ComponentNode {
  const working = cloneTree(oldRoot);
  for (const op of ops) {
    applyOperation(working, op);
  }
  return working;
}
