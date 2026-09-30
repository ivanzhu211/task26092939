/**
 * 组件树节点。除 id / children 外允许携带任意业务字段，
 * 本库只关心结构（父子关系与同层顺序），其余字段原样保留。
 */
export interface ComponentNode {
  id: string;
  /** 有序子组件列表；缺省视为空数组。 */
  children?: ComponentNode[];
  [key: string]: unknown;
}

/** 新增：在 parentId 下 index 处创建不带子组件的新节点。 */
export interface AddOperation {
  type: 'add';
  /** 新快照独有的组件 id。 */
  id: string;
  parentId: string;
  index: number;
  /** 新节点的数据（不含子组件）。 */
  node: ComponentNode;
}

/** 删除：移除该组件及其当前整棵子树。 */
export interface RemoveOperation {
  type: 'remove';
  /** 旧快照独有的组件 id（其当前子树中也只能包含旧快照独有的 id）。 */
  id: string;
}

/** 移动：把组件及其当前整棵子树放到 parentId 下的 index 处。 */
export interface MoveOperation {
  type: 'move';
  id: string;
  parentId: string;
  /** 先从当前位置摘下、再插入到目标父组件下时的下标。 */
  index: number;
}

export type TreeOperation = AddOperation | RemoveOperation | MoveOperation;
