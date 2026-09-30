import { ComponentNode, TreeOperation } from './types';

interface TreeIndex {
  /** id -> 父节点 id；根节点不在表中。 */
  parent: Map<string, string>;
  /** id -> 有序子节点 id 列表（无子节点时为空数组）。 */
  children: Map<string, string[]>;
  /** id -> 节点对象。 */
  nodes: Map<string, ComponentNode>;
}

function buildIndex(root: ComponentNode): TreeIndex {
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const nodes = new Map<string, ComponentNode>();
  const stack: ComponentNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as ComponentNode;
    if (nodes.has(node.id)) {
      throw new Error(`快照中存在重复 id "${node.id}"`);
    }
    nodes.set(node.id, node);
    const childIds: string[] = [];
    for (const child of node.children ?? []) {
      parent.set(child.id, node.id);
      childIds.push(child.id);
      stack.push(child);
    }
    children.set(node.id, childIds);
  }
  return { parent, children, nodes };
}

/** 求严格递增最长子序列，返回应保留（不移动）的元素下标集合。 */
function lisKeepIndices(sequence: number[]): Set<number> {
  const tails: number[] = [];
  const prev: number[] = new Array(sequence.length).fill(-1);
  for (let i = 0; i < sequence.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sequence[tails[mid]] < sequence[i]) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo > 0) {
      prev[i] = tails[lo - 1];
    }
    if (lo === tails.length) {
      tails.push(i);
    } else {
      tails[lo] = i;
    }
  }
  const keep = new Set<number>();
  let cursor = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (cursor >= 0) {
    keep.add(cursor);
    cursor = prev[cursor];
  }
  return keep;
}

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
export function diffTrees(oldRoot: ComponentNode, newRoot: ComponentNode): TreeOperation[] {
  if (oldRoot.id !== newRoot.id) {
    throw new Error('两份快照必须使用同一个根组件');
  }
  const oldTree = buildIndex(oldRoot);
  const newTree = buildIndex(newRoot);

  const kept = new Set<string>();
  const added = new Set<string>();
  const removed = new Set<string>();
  for (const id of newTree.nodes.keys()) {
    if (oldTree.nodes.has(id)) {
      kept.add(id);
    } else {
      added.add(id);
    }
  }
  for (const id of oldTree.nodes.keys()) {
    if (!newTree.nodes.has(id)) {
      removed.add(id);
    }
  }

  // 1. 计算最小移动集合。
  const mustMove = new Set<string>();
  for (const id of kept) {
    if (id === oldRoot.id) {
      continue; // 根组件不移动
    }
    if (oldTree.parent.get(id) !== newTree.parent.get(id)) {
      mustMove.add(id);
    }
  }
  for (const [parentId, newChildIds] of newTree.children) {
    const oldChildIds = oldTree.children.get(parentId);
    if (!oldChildIds) {
      continue; // 新增父组件的子节点全部按“父组件变化”处理
    }
    // 两侧父组件都是 parentId 的保留子组件。
    const oldOrder = oldChildIds.filter(
      (id) => kept.has(id) && newTree.parent.get(id) === parentId,
    );
    if (oldOrder.length === 0) {
      continue;
    }
    const newRank = new Map<string, number>();
    newChildIds.forEach((id, index) => {
      if (kept.has(id) && oldTree.parent.get(id) === parentId) {
        newRank.set(id, index);
      }
    });
    const sequence = oldOrder.map((id) => newRank.get(id) as number);
    const keepIndices = lisKeepIndices(sequence);
    oldOrder.forEach((id, index) => {
      if (!keepIndices.has(index)) {
        mustMove.add(id);
      }
    });
  }

  // 2. 在工作状态（只存结构）上按新快照先序遍历生成 add / move。
  const workParent = new Map<string, string>(oldTree.parent);
  const workChildren = new Map<string, string[]>();
  for (const [id, childIds] of oldTree.children) {
    workChildren.set(id, [...childIds]);
  }

  const ops: TreeOperation[] = [];

  const finalIndexOf = (parentId: string, id: string): number => {
    // 目标父组件当前子节点中，属于“最终子节点且排在 id 之前”的个数。
    const finalSiblings = newTree.children.get(parentId) as string[];
    const myRank = finalSiblings.indexOf(id);
    // 目标父组件当前的子节点中，可能混着将被移走或删除的节点，
    // 因此插入点是“最后一个排在 id 之前的最终兄弟”的紧后方。
    const current = workChildren.get(parentId) as string[];
    let index = 0;
    for (let i = 0; i < current.length; i++) {
      const rank = finalSiblings.indexOf(current[i]);
      if (rank !== -1 && rank < myRank) {
        index = i + 1;
      }
    }
    return index;
  };

  const placeChildren = (parentId: string): void => {
    for (const childId of newTree.children.get(parentId) as string[]) {
      if (added.has(childId)) {
        const index = finalIndexOf(parentId, childId);
        const source = newTree.nodes.get(childId) as ComponentNode;
        const node = JSON.parse(JSON.stringify(source)) as ComponentNode;
        delete node.children; // 新增节点不带子组件
        ops.push({ type: 'add', id: childId, parentId, index, node });
        workParent.set(childId, parentId);
        (workChildren.get(parentId) as string[]).splice(index, 0, childId);
        workChildren.set(childId, []);
      } else if (mustMove.has(childId)) {
        // 先从当前位置摘下，再计算插入下标。
        const fromId = workParent.get(childId) as string;
        const fromSiblings = workChildren.get(fromId) as string[];
        fromSiblings.splice(fromSiblings.indexOf(childId), 1);
        const index = finalIndexOf(parentId, childId);
        ops.push({ type: 'move', id: childId, parentId, index });
        workParent.set(childId, parentId);
        (workChildren.get(parentId) as string[]).splice(index, 0, childId);
      }
      placeChildren(childId);
    }
  };
  placeChildren(newRoot.id);

  // 3. 最后删除旧快照独有的组件（只删最外层，子树随之移除）。
  // 注意：保留组件迁出被删子树时可能携带旧独有的后代，
  // 因此“最外层”必须按旧快照中父组件是否为旧独有来判断，而不能在旧树上剪枝。
  const collectRemoved = (id: string): void => {
    for (const childId of oldTree.children.get(id) as string[]) {
      if (removed.has(childId) && !removed.has(id)) {
        ops.push({ type: 'remove', id: childId });
      }
      collectRemoved(childId);
    }
  };
  collectRemoved(oldRoot.id);

  return ops;
}
