import type { InspectionAnswer, TemplateRevision, ValidationIssue } from '@jianjian/contracts';
import { waterFocusItems } from './modules.js';

const benignResults = new Set(['正常', '无故障码', '数据正常', '未配备', '此项检测无此服务']);

export function answerNeedsNote(item: TemplateRevision['sections'][number]['items'][number], answer?: InspectionAnswer): boolean {
  if (!answer?.value) return false;
  return answer.value === '自定义' || Boolean(item.requiresNoteWhen?.includes(answer.value));
}

export function answerIsAbnormal(answer?: InspectionAnswer): boolean {
  return Boolean(answer?.value && !benignResults.has(answer.value));
}

export function validateInspection(
  template: TemplateRevision,
  answers: InspectionAnswer[],
  mediaStates: Record<string, 'PENDING' | 'UPLOADING' | 'READY' | 'FAILED'> = {},
): ValidationIssue[] {
  const answerMap = new Map(answers.map((answer) => [answer.itemKey, answer]));
  const issues: ValidationIssue[] = [];
  for (const section of template.sections) {
    for (const item of section.items) {
      const answer = answerMap.get(item.key);
      if (!answer?.value) {
        if (item.required) {
          issues.push({ code: 'REQUIRED_ITEM_MISSING', itemKey: item.key, sectionKey: section.key, message: `请选择“${item.title}”的检查结果。` });
        }
        continue;
      }
      if (item.requiresSizeWhenAbnormal && answer.value !== '正常' && !answer.size) {
        issues.push({ code: 'SIZE_JUDGMENT_REQUIRED', itemKey: item.key, sectionKey: section.key, message: `请补充“${item.title}”的30cm×30cm尺寸判定。` });
      }
      if (answerNeedsNote(item, answer) && !answer.note?.trim()) {
        issues.push({ code: 'NOTE_REQUIRED', itemKey: item.key, sectionKey: section.key, message: `请填写“${item.title}”的${item.noteLabel ?? '车况说明'}。` });
      }
      if (answerIsAbnormal(answer) && !answer.photoIds?.length) {
        issues.push({ code: 'EVIDENCE_REQUIRED', itemKey: item.key, sectionKey: section.key, message: `请为“${item.title}”的异常结果添加现场照片。` });
      }
      if (answer.photoIds?.some((id) => mediaStates[id] && mediaStates[id] !== 'READY')) {
        issues.push({ code: 'MEDIA_NOT_READY', itemKey: item.key, sectionKey: section.key, message: `“${item.title}”的现场照片尚未上传完成。` });
      }
    }
  }
  return issues;
}

export function getInspectionAlerts(template: TemplateRevision, answers: InspectionAnswer[]) {
  const answerMap = new Map(answers.map((answer) => [answer.itemKey, answer]));
  let accidentCount = 0;
  let waterCount = 0;
  let fireCount = 0;
  for (const section of template.sections) {
    for (const item of section.items) {
      const answer = answerMap.get(item.key);
      if (!answer) continue;
      if (item.requiresSizeWhenAbnormal && answer.value !== '正常' && answer.size === 'GREATER_THAN_30') accidentCount += 1;
      if (section.key === 'water' && waterFocusItems.has(item.title) && answer.value === '水渍泥沙') waterCount += 1;
      if (section.key === 'fire' && ['烧蚀', '熏黑碳化', '炙烤融化'].includes(answer.value)) fireCount += 1;
    }
  }
  return {
    accidentCount,
    waterCount,
    fireCount,
    accident: accidentCount > 0,
    water: waterCount >= 3,
    fire: fireCount > 0,
  };
}

export function completionCount(template: TemplateRevision, answers: InspectionAnswer[]) {
  const answerMap = new Map(answers.map((answer) => [answer.itemKey, answer]));
  let completed = 0;
  for (const section of template.sections) {
    for (const item of section.items) {
      const answer = answerMap.get(item.key);
      if (!answer?.value) continue;
      if (item.requiresSizeWhenAbnormal && answer.value !== '正常' && !answer.size) continue;
      if (answerNeedsNote(item, answer) && !answer.note?.trim()) continue;
      completed += 1;
    }
  }
  return completed;
}
