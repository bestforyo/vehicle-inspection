export const ROLES = {
  PLATFORM_SUPER_ADMIN: 'PLATFORM_SUPER_ADMIN',
  PLATFORM_OPERATOR: 'PLATFORM_OPERATOR',
  ORG_ADMIN: 'ORG_ADMIN',
  INSPECTOR: 'INSPECTOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type TenantRole = Extract<Role, 'ORG_ADMIN' | 'INSPECTOR'>;
export type StandardCode = 'NATIONAL' | 'GROUP';
export type PackageCode = 'THREE_NON' | 'FOUR_NON' | 'FULL' | 'NEW_CAR' | 'NEW_ENERGY';
export type VehicleKind = 'PASSENGER_CAR' | 'MOTORCYCLE';
export type OrderStatus =
  | 'PENDING_INSPECTION'
  | 'INSPECTING'
  | 'REVIEW_PENDING'
  | 'NEEDS_MODIFICATION'
  | 'PUBLISHED'
  | 'CANCELLED';
export type InspectionStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'PUBLISHED';
export type ReportStatus = 'PUBLISHED' | 'VOID';
export type ShareStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface SessionUser {
  id: string;
  displayName: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}

export interface InspectionOption {
  value: string;
  label: string;
  tone?: 'dark' | 'green';
}

export interface TemplateItem {
  key: string;
  title: string;
  answerType: 'SINGLE_CHOICE';
  options: InspectionOption[];
  required: boolean;
  critical?: boolean;
  requiresSizeWhenAbnormal?: boolean;
  requiresNoteWhen?: string[];
  noteLabel?: string;
  material?: 'PLASTIC' | 'METAL';
  professionalReviewRequired?: boolean;
}

export interface TemplateSection {
  key: string;
  title: string;
  guidance?: string;
  items: TemplateItem[];
}

export interface TemplateRevision {
  id: string;
  templateId: string;
  revisionNumber: number;
  standardRevisionId: string;
  standard: StandardCode;
  standardTitle: string;
  standardVersion: string;
  kind: VehicleKind;
  packageCode: PackageCode;
  packageName: string;
  description: string;
  status: 'DRAFT' | 'PROFESSIONAL_REVIEW' | 'PUBLISHED' | 'DISABLED';
  sections: TemplateSection[];
}

export interface InspectionAnswer {
  itemKey: string;
  sectionKey: string;
  value: string;
  size?: 'GREATER_THAN_30' | 'LESS_THAN_30';
  note?: string;
  photoIds?: string[];
  updatedAt: string;
}

export interface ValidationIssue {
  code:
    | 'REQUIRED_ITEM_MISSING'
    | 'SIZE_JUDGMENT_REQUIRED'
    | 'NOTE_REQUIRED'
    | 'EVIDENCE_REQUIRED'
    | 'MEDIA_NOT_READY';
  itemKey: string;
  sectionKey: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const PACKAGE_NAMES: Record<PackageCode, string> = {
  THREE_NON: '三非排查',
  FOUR_NON: '四非排查',
  FULL: '整车检测',
  NEW_CAR: '新车检测',
  NEW_ENERGY: '新能源检测',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_INSPECTION: '待检测',
  INSPECTING: '检测中',
  REVIEW_PENDING: '待审核',
  NEEDS_MODIFICATION: '待修改',
  PUBLISHED: '已完成',
  CANCELLED: '已取消',
};
