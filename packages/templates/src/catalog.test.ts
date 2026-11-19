import { describe, expect, it } from 'vitest';
import type { InspectionAnswer, PackageCode, StandardCode } from '@jianjian/contracts';
import { countTemplateItems, getInspectionAlerts, getTemplate, templateCatalog, validateInspection } from './index.js';

const expected: Record<StandardCode, Record<Exclude<PackageCode, 'NEW_ENERGY'>, number>> = {
  GROUP: { THREE_NON: 115, FOUR_NON: 121, FULL: 180, NEW_CAR: 158 },
  NATIONAL: { THREE_NON: 95, FOUR_NON: 101, FULL: 160, NEW_CAR: 138 },
};

describe('乘用车模板目录', () => {
  it('仅发布八套准确映射的示范模板', () => {
    expect(templateCatalog).toHaveLength(8);
    for (const template of templateCatalog) {
      expect(countTemplateItems(template)).toBe(expected[template.standard][template.packageCode as Exclude<PackageCode, 'NEW_ENERGY'>]);
    }
  });

  it('严格保留重大事故项目数和内部关键项配置', () => {
    const group = getTemplate('GROUP', 'FULL').sections[1];
    const national = getTemplate('NATIONAL', 'FULL').sections[1];
    expect(group.items).toHaveLength(59);
    expect(group.items.filter((item) => item.critical)).toHaveLength(28);
    expect(national.items).toHaveLength(39);
    expect(national.items.filter((item) => item.critical)).toHaveLength(22);
    expect(national.items.map((item) => item.title).slice(0, 4)).toEqual(['可拆水箱框架', '左前纵梁', '左前车灯框架', '不可拆水箱框架']);
  });

  it('关键项缺尺寸、条件说明和异常照片会阻止提交', () => {
    const template = getTemplate('GROUP', 'FULL');
    const item = template.sections[1].items.find((entry) => entry.critical)!;
    const answer: InspectionAnswer = { itemKey: item.key, sectionKey: 'accident', value: '变形', updatedAt: new Date().toISOString() };
    expect(validateInspection(template, [answer]).some((issue) => issue.code === 'SIZE_JUDGMENT_REQUIRED')).toBe(true);
    answer.size = 'GREATER_THAN_30';
    expect(validateInspection(template, [answer]).some((issue) => issue.code === 'EVIDENCE_REQUIRED')).toBe(true);
    answer.photoIds = ['photo-1'];
    expect(validateInspection(template, [answer]).some((issue) => issue.itemKey === item.key)).toBe(false);
  });

  it('只有三个重点泡水项达到阈值才提示泡水', () => {
    const template = getTemplate('GROUP', 'FULL');
    const items = template.sections.find((section) => section.key === 'water')!.items.filter((item) => item.requiresNoteWhen?.includes('水渍泥沙'));
    expect(items).toHaveLength(5);
    const answers = items.slice(0, 3).map((item): InspectionAnswer => ({ itemKey: item.key, sectionKey: 'water', value: '水渍泥沙', note: '现场见泥沙', updatedAt: new Date().toISOString() }));
    expect(getInspectionAlerts(template, answers.slice(0, 2)).water).toBe(false);
    expect(getInspectionAlerts(template, answers).water).toBe(true);
  });

  it('火烧结果和事故尺寸触发对应提示', () => {
    const template = getTemplate('GROUP', 'FULL');
    const fire = template.sections.find((section) => section.key === 'fire')!.items[0];
    const critical = template.sections[1].items.find((item) => item.critical)!;
    const answers: InspectionAnswer[] = [
      { itemKey: fire.key, sectionKey: 'fire', value: '熏黑碳化', updatedAt: new Date().toISOString() },
      { itemKey: critical.key, sectionKey: 'accident', value: '变形', size: 'GREATER_THAN_30', updatedAt: new Date().toISOString() },
    ];
    const alerts = getInspectionAlerts(template, answers);
    expect(alerts.fire).toBe(true);
    expect(alerts.accident).toBe(true);
  });
});
