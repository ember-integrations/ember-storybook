export interface ComponentSignature {
  args: Record<string, ArgInfo>;
  blocks: Record<string, BlockInfo>;
  element: string | undefined;
  style: {
    customProperties: Record<string, string>;
    parts: Record<string, string>;
  };
}

export interface ArgInfo {
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface BlockParam {
  name: string;
  type: string;
  description?: string;
  componentRef?: undefined | { filePath: string; exportName: string };
}

export interface BlockInfo {
  params: BlockParam[];
  description?: string;
}

export type ComponentSignatureMap = Record<string, Record<string, ComponentSignature>>;
