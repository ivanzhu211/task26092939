"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffComponentTrees = void 0;
const tree_1 = require("./tree");
const lcs_1 = require("./lcs");
/** 深拷贝 JSON 风格的自有属性值（输入保证来自 JSON 快照）。 */
function deepCloneValue(value) {
    if (Array.isArray(value)) {
        return value.map(deepCloneValue);
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value)) {
            out[key] = deepCloneValue(value[key]);
        }
        return out;
    }
    return value;
}
/** 生成 add 操作携带的节点数据：剥离 children 的深拷贝。 */
function stripNode(node) {
    const out = {};
    for (const key of Object.keys(node)) {
        if (key !== 'children') {
            out[key] = deepCloneValue(node[key]);
        }
    }
    return out;
}
/**
 * 计算把 oldTree 转换为 newTree 的结构编辑方案。
 *
 * 方案只包含 add / remove / move 三类操作，且在所有可行方案中
 * move 次数达到全局最少（add / remove 不计入）。
 * 传入的两份快照不会被修改。
 */
function diffComponentTrees(oldTree, newTree) {
    const oldModel = (0, tree_1.buildTreeModel)(oldTree);
    const newModel = (0, tree_1.buildTreeModel)(newTree);
    if (oldModel.root.id !== newModel.root.id) {
        throw new Error('两份快照必须使用同一个根组件');
    }
    const oldIds = oldModel.nodes;
    const newIds = newModel.nodes;
    // 新快照中每个节点在父组件下的位次
    const newRank = new Map();
    for (const [id, parentId] of newModel.parentOf) {
        newRank.set(id, newModel.childrenOf.get(parentId).indexOf(id));
    }
    // ---- 计算必须移动的节点集合（移动次数全局最少的证明见 README） ----
    const moveSet = new Set();
    for (const id of newIds.keys()) {
        if (!oldIds.has(id)) {
            continue; // 新增组件
        }
        if (id === newModel.root.id) {
            continue; // 根组件不能移动
        }
        const oldParent = oldModel.parentOf.get(id);
        const newParent = newModel.parentOf.get(id);
        if (oldParent !== newParent) {
            moveSet.add(id); // 父组件变化（含父组件被删除），必须移动
        }
    }
    // 同父组件下的调序：保留一个 LCS 不动，其余各移动一次
    for (const [parentId, newChildren] of newModel.childrenOf) {
        const stayersInNewOrder = newChildren.filter((id) => oldIds.has(id) && oldModel.parentOf.get(id) === parentId);
        if (stayersInNewOrder.length === 0) {
            continue;
        }
        const oldChildren = oldModel.childrenOf.get(parentId);
        const stayersInOldOrder = oldChildren.filter((id) => stayersInNewOrder.includes(id));
        const keep = new Set((0, lcs_1.longestCommonSubsequence)(stayersInOldOrder, stayersInNewOrder));
        for (const id of stayersInNewOrder) {
            if (!keep.has(id)) {
                moveSet.add(id);
            }
        }
    }
    // ---- 在旧树的模拟副本上依次生成具体操作 ----
    const simChildren = new Map();
    const simParent = new Map();
    for (const [id, kids] of oldModel.childrenOf) {
        simChildren.set(id, [...kids]);
    }
    for (const [id, parentId] of oldModel.parentOf) {
        simParent.set(id, parentId);
    }
    // 已就位的组件：相对顺序已与目标一致的常驻组件
    const settled = new Set();
    for (const id of oldIds.keys()) {
        if (newIds.has(id) && !moveSet.has(id)) {
            settled.add(id);
        }
    }
    const operations = [];
    // 在 parentId 的当前子列表中，为“新快照里父组件为 parentId、位次为 rank 的
    // 组件”计算插入位置：排在所有已就位且位次更靠前的组件之后。
    const finalIndexOf = (id, parentId) => {
        const rank = newRank.get(id);
        const siblings = simChildren.get(parentId);
        let index = 0;
        for (let i = 0; i < siblings.length; i++) {
            const sib = siblings[i];
            if (settled.has(sib) &&
                newModel.parentOf.get(sib) === parentId &&
                newRank.get(sib) < rank) {
                index = i + 1;
            }
        }
        return index;
    };
    // 1) 新增：按新快照深度自顶向下，保证父组件已存在
    const addedIds = [...newIds.keys()].filter((id) => !oldIds.has(id));
    addedIds.sort((a, b) => newModel.depthOf.get(a) - newModel.depthOf.get(b));
    for (const id of addedIds) {
        const parentId = newModel.parentOf.get(id);
        const index = finalIndexOf(id, parentId);
        operations.push({
            type: 'add',
            id,
            parentId,
            index,
            node: stripNode(newIds.get(id)),
        });
        simChildren.get(parentId).splice(index, 0, id);
        simChildren.set(id, []);
        simParent.set(id, parentId);
        settled.add(id);
    }
    // 2) 移动：按新快照深度自顶向下，保证目标父组件已就位，
    //    从而不会把组件移到自己或后代的下面
    const movedIds = [...moveSet];
    movedIds.sort((a, b) => newModel.depthOf.get(a) - newModel.depthOf.get(b));
    for (const id of movedIds) {
        const parentId = newModel.parentOf.get(id);
        const oldSiblings = simChildren.get(simParent.get(id));
        oldSiblings.splice(oldSiblings.indexOf(id), 1);
        const index = finalIndexOf(id, parentId);
        operations.push({ type: 'move', id, parentId, index });
        simChildren.get(parentId).splice(index, 0, id);
        simParent.set(id, parentId);
        settled.add(id);
    }
    // 3) 删除：此时被删除子树中只剩旧快照独有的组件，
    //    只需删除父组件仍在树中的最外层节点
    for (const id of oldIds.keys()) {
        if (newIds.has(id)) {
            continue;
        }
        const parentId = simParent.get(id);
        if (!newIds.has(parentId)) {
            // 父组件也会被删除，随父组件一起移除，无需单独操作
            continue;
        }
        operations.push({ type: 'remove', id });
        const siblings = simChildren.get(parentId);
        siblings.splice(siblings.indexOf(id), 1);
    }
    return operations;
}
exports.diffComponentTrees = diffComponentTrees;
