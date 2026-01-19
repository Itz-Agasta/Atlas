// FIXME: its migrated
export type ArgoFloat = {
  id: string; // Format: AL032017_20170619180000
  floatNumber: string; // Format: 2902203
  longitude: number;
  latitude: number;
  date: string; // ISO string
  cycle: number;
  platformType: string;
  pi: string; // Principal Investigator
  telecomCode: string;
  sensors: string[];
  name?: string;
  description?: string;
  depth?: number;
  temperature?: number;
  salinity?: number;
};

export type TooltipData = {
  id: string;
  longitude: number;
  latitude: number;
  date: string;
  cycle: number;
};

export type PopupData = {
  floatNumber: string;
  cycle: number;
  date: string;
  platformType: string;
  pi: string;
  telecomCode: string;
  sensors: string[];
};
