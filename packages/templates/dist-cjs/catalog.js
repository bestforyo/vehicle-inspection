"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateCatalog = void 0;
exports.createTemplate = createTemplate;
exports.getTemplate = getTemplate;
exports.getTemplateByRevisionId = getTemplateByRevisionId;
exports.countTemplateItems = countTemplateItems;
exports.templateSummaries = templateSummaries;
const contracts_1 = require("@jianjian/contracts");
const modules_js_1 = require("./modules.js");
const packages = ['THREE_NON', 'FOUR_NON', 'FULL', 'NEW_CAR'];
function sectionsFor(standard, packageCode) {
    const accident = standard === 'NATIONAL' ? (0, modules_js_1.nationalAccidentSection)() : (0, modules_js_1.groupAccidentSection)();
    if (packageCode === 'THREE_NON')
        return [(0, modules_js_1.paintSection)(), accident, (0, modules_js_1.waterSection)(), (0, modules_js_1.fireSection)()];
    if (packageCode === 'FOUR_NON')
        return [(0, modules_js_1.paintSection)(), accident, (0, modules_js_1.waterSection)(), (0, modules_js_1.fireSection)(), (0, modules_js_1.mileageSection)()];
    if (packageCode === 'NEW_CAR') {
        return [(0, modules_js_1.paintSection)(), accident, (0, modules_js_1.glassSection)(), (0, modules_js_1.interiorSection)(), (0, modules_js_1.obdSection)(), (0, modules_js_1.chassisSection)(), (0, modules_js_1.newCarFunctionSection)()];
    }
    return [
        (0, modules_js_1.paintSection)(), accident, (0, modules_js_1.waterSection)(), (0, modules_js_1.fireSection)(), (0, modules_js_1.glassSection)(), (0, modules_js_1.interiorSection)(),
        (0, modules_js_1.obdSection)(), (0, modules_js_1.mileageSection)(), (0, modules_js_1.powertrainSection)(), (0, modules_js_1.chassisSection)(),
    ];
}
function createTemplate(standard, packageCode) {
    if (packageCode === 'NEW_ENERGY')
        throw new Error('新能源检测正在建设中，暂无可用模板。');
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
        packageName: contracts_1.PACKAGE_NAMES[packageCode],
        description: `${contracts_1.PACKAGE_NAMES[packageCode]}动态模板；示范数据须经专业审核后方可用于正式检测。`,
        status: 'PUBLISHED',
        sections: sectionsFor(standard, packageCode),
    };
}
exports.templateCatalog = ['NATIONAL', 'GROUP'].flatMap((standard) => packages.map((packageCode) => createTemplate(standard, packageCode)));
function getTemplate(standard, packageCode) {
    const template = exports.templateCatalog.find((entry) => entry.standard === standard && entry.packageCode === packageCode);
    if (!template)
        throw new Error('所选检测类型暂未配置。');
    return structuredClone(template);
}
function getTemplateByRevisionId(revisionId) {
    const template = exports.templateCatalog.find((entry) => entry.id === revisionId);
    return template ? structuredClone(template) : undefined;
}
function countTemplateItems(template) {
    return template.sections.reduce((total, section) => total + section.items.length, 0);
}
function templateSummaries(standard) {
    return [...packages, 'NEW_ENERGY'].map((packageCode) => {
        if (packageCode === 'NEW_ENERGY') {
            return {
                packageCode,
                packageName: contracts_1.PACKAGE_NAMES[packageCode],
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
//# sourceMappingURL=catalog.js.map