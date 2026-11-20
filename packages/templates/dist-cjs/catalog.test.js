"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_js_1 = require("./index.js");
const expected = {
    GROUP: { THREE_NON: 115, FOUR_NON: 121, FULL: 180, NEW_CAR: 158 },
    NATIONAL: { THREE_NON: 95, FOUR_NON: 101, FULL: 160, NEW_CAR: 138 },
};
(0, vitest_1.describe)('乘用车模板目录', () => {
    (0, vitest_1.it)('仅发布八套准确映射的示范模板', () => {
        (0, vitest_1.expect)(index_js_1.templateCatalog).toHaveLength(8);
        for (const template of index_js_1.templateCatalog) {
            (0, vitest_1.expect)((0, index_js_1.countTemplateItems)(template)).toBe(expected[template.standard][template.packageCode]);
        }
    });
    (0, vitest_1.it)('严格保留重大事故项目数和内部关键项配置', () => {
        const group = (0, index_js_1.getTemplate)('GROUP', 'FULL').sections[1];
        const national = (0, index_js_1.getTemplate)('NATIONAL', 'FULL').sections[1];
        (0, vitest_1.expect)(group.items).toHaveLength(59);
        (0, vitest_1.expect)(group.items.filter((item) => item.critical)).toHaveLength(28);
        (0, vitest_1.expect)(national.items).toHaveLength(39);
        (0, vitest_1.expect)(national.items.filter((item) => item.critical)).toHaveLength(22);
        (0, vitest_1.expect)(national.items.map((item) => item.title).slice(0, 4)).toEqual(['可拆水箱框架', '左前纵梁', '左前车灯框架', '不可拆水箱框架']);
    });
    (0, vitest_1.it)('关键项缺尺寸、条件说明和异常照片会阻止提交', () => {
        const template = (0, index_js_1.getTemplate)('GROUP', 'FULL');
        const item = template.sections[1].items.find((entry) => entry.critical);
        const answer = { itemKey: item.key, sectionKey: 'accident', value: '变形', updatedAt: new Date().toISOString() };
        (0, vitest_1.expect)((0, index_js_1.validateInspection)(template, [answer]).some((issue) => issue.code === 'SIZE_JUDGMENT_REQUIRED')).toBe(true);
        answer.size = 'GREATER_THAN_30';
        (0, vitest_1.expect)((0, index_js_1.validateInspection)(template, [answer]).some((issue) => issue.code === 'EVIDENCE_REQUIRED')).toBe(true);
        answer.photoIds = ['photo-1'];
        (0, vitest_1.expect)((0, index_js_1.validateInspection)(template, [answer]).some((issue) => issue.itemKey === item.key)).toBe(false);
    });
    (0, vitest_1.it)('只有三个重点泡水项达到阈值才提示泡水', () => {
        const template = (0, index_js_1.getTemplate)('GROUP', 'FULL');
        const items = template.sections.find((section) => section.key === 'water').items.filter((item) => item.requiresNoteWhen?.includes('水渍泥沙'));
        (0, vitest_1.expect)(items).toHaveLength(5);
        const answers = items.slice(0, 3).map((item) => ({ itemKey: item.key, sectionKey: 'water', value: '水渍泥沙', note: '现场见泥沙', updatedAt: new Date().toISOString() }));
        (0, vitest_1.expect)((0, index_js_1.getInspectionAlerts)(template, answers.slice(0, 2)).water).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.getInspectionAlerts)(template, answers).water).toBe(true);
    });
    (0, vitest_1.it)('火烧结果和事故尺寸触发对应提示', () => {
        const template = (0, index_js_1.getTemplate)('GROUP', 'FULL');
        const fire = template.sections.find((section) => section.key === 'fire').items[0];
        const critical = template.sections[1].items.find((item) => item.critical);
        const answers = [
            { itemKey: fire.key, sectionKey: 'fire', value: '熏黑碳化', updatedAt: new Date().toISOString() },
            { itemKey: critical.key, sectionKey: 'accident', value: '变形', size: 'GREATER_THAN_30', updatedAt: new Date().toISOString() },
        ];
        const alerts = (0, index_js_1.getInspectionAlerts)(template, answers);
        (0, vitest_1.expect)(alerts.fire).toBe(true);
        (0, vitest_1.expect)(alerts.accident).toBe(true);
    });
});
//# sourceMappingURL=catalog.test.js.map