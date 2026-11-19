import type { InspectionAnswer, OrderStatus, ReportStatus, Role, ShareStatus, TemplateRevision } from '@jianjian/contracts';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}

export interface Order {
  id: string;
  orderNo: string;
  status: OrderStatus;
  templateRevisionId: string;
  currentRevisionId: string;
  assignedInspectorId: string;
  packageName: string;
  standard: string;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    kind: string;
    plate: string;
    vin: string;
    brand: string;
    model: string;
    year?: number;
    firstRegisteredAt?: string;
    mileage?: number;
  };
}

export interface Inspection {
  id: string;
  revisionNumber: number;
  lockVersion: number;
  status: string;
  orderStatus: OrderStatus;
  template: TemplateRevision;
  answers: InspectionAnswer[];
  evidence: Array<{ id: string; itemKey: string; status: string; previewUrl: string; width?: number; height?: number }>;
  submittedAt?: string;
}

export interface Report {
  id: string;
  reportNo: string;
  status: ReportStatus;
  snapshot: PublicReport;
  publishedAt: string;
  shares: Array<{ id: string; status: ShareStatus; expiresAt: string }>;
}

export interface PublicReport {
  title: string;
  reportNo: string;
  versionNumber: number;
  organization: { displayName: string; name: string; logoText: string; reportTheme: string };
  vehicle: { kind: string; brand: string; model: string; year?: number; plate: string; vin: string; mileage?: number; firstRegisteredAt?: string };
  template: TemplateRevision;
  answers: InspectionAnswer[];
  alerts: { accident: boolean; water: boolean; fire: boolean; accidentCount: number; waterCount: number; fireCount: number };
  inspectorName: string;
  reviewerName: string;
  publishedAt: string;
  expiresAt?: string;
  disclaimer: string;
}
