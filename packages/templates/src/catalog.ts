import type { PackageCode, StandardCode, TemplateRevision, TemplateSection } from '@jianjian/contracts';
import { PACKAGE_NAMES } from '@jianjian/contracts';
import {
  chassisSection,
  fireSection,
  glassSection,
  groupAccidentSection,
  interiorSection,
  mileageSection,
  nationalAccidentSection,
  newCarFunctionSection,
  obdSection,
  paintSection,
  powertrainSection,
  waterSection,
} from './modules.js';

const packages: PackageCode[] = ['THREE_NON', 'FOUR_NON', 'FULL', 'NEW_CAR'];

function sectionsFor(standard: StandardCode, packageCode: PackageCode): TemplateSection[] {
  const accident = standard === 'NATIONAL' ? nationalAccidentSection() : groupAccidentSection();
  if (packageCode === 'THREE_NON') return [paintSection(), accident, waterSection(), fireSection()];
  if (packageCode === 'FOUR_NON') return [paintSection(), accident, waterSection(), fireSection(), mileageSection()];
  if (packageCode === 'NEW_CAR') {
    return [paintSection(), accident, glassSection(), interiorSection(), obdSection(), chassisSection(), newCarFunctionSection()];
  }
  return [
    paintSection(), accident, waterSection(), fireSection(), glassSection(), interiorSection(),
    obdSection(), mileageSection(), powertrainSection(), chassisSection(),
  ];
}

export function createTemplate(standard: StandardCode, packageCode: PackageCode): TemplateRevision {
  if (packageCode === 'NEW_ENERGY') throw new Error('新能源检测正在建设中，暂无可用模板。');
  const slug = `${standard.toLowerCase()}-${packageCode.toLowerCase().replaceAll('_', '-')}`;
  return {
    id: `revision-${slug}-1`,
    templateId: `template-${slug}`,
    revisionNumber: 1,
    standardRevisionId: `standard-${standard.toLowerCase()}-prototype-1`,
    standard,
    standardTitle: standard === 'NATIONAL' ? '国家标准配置示范清单' : '团体标准配置示范清单',
    standardVersion: 'DEMO-2026.1',
    kind: 'PASSENGER_CAR',
    packageCode,
    packageName: PACKAGE_NAMES[packageCode],
    description: `${PACKAGE_NAMES[packageCode]}动态模板；示范数据须经专业审核后方可用于正式检测。`,
    status: 'PUBLISHED',
    sections: sectionsFor(standard, packageCode),
  };
}

export const templateCatalog: TemplateRevision[] = (['NATIONAL', 'GROUP'] as StandardCode[]).flatMap((standard) =>
  packages.map((packageCode) => createTemplate(standard, packageCode)),
);

export function getTemplate(standard: StandardCode, packageCode: PackageCode): TemplateRevision {
  const template = templateCatalog.find((entry) => entry.standard === standard && entry.packageCode === packageCode);
  if (!template) throw new Error('所选检测类型暂未配置。');
  return structuredClone(template);
}

export function getTemplateByRevisionId(revisionId: string): TemplateRevision | undefined {
  const template = templateCatalog.find((entry) => entry.id === revisionId);
  return template ? structuredClone(template) : undefined;
}

export function countTemplateItems(template: TemplateRevision): number {
  return template.sections.reduce((total, section) => total + section.items.length, 0);
}

export function templateSummaries(standard: StandardCode) {
  return [...packages, 'NEW_ENERGY' as PackageCode].map((packageCode) => {
    if (packageCode === 'NEW_ENERGY') {
      return {
        packageCode,
        packageName: PACKAGE_NAMES[packageCode],
        available: false,
        unavailableReason: '正在建设中，敬请期待',
        sectionCount: 0,
        itemCount: 0,
      };
    }
    const template = getTemplate(standard, packageCode);
    return {
      packageCode,
      packageName: template.packageName,
      available: true,
      templateRevisionId: template.id,
      revisionNumber: template.revisionNumber,
      sectionCount: template.sections.length,
      itemCount: countTemplateItems(template),
    };
  });
}
