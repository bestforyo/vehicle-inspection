import { useEffect, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle } from 'lucide-react';
import type { InspectionAnswer, TemplateItem } from '@jianjian/contracts';
import { answerNeedsNote } from '@jianjian/templates';
import { api } from '../api';

interface Evidence {
  id: string;
  itemKey: string;
  status: string;
  previewUrl: string;
}

export function InspectionItemRow({ item, sectionKey, index, answer, evidence, readOnly, uploading, onChange, onUpload }: {
  item: TemplateItem;
  sectionKey: string;
  index: number;
  answer?: InspectionAnswer;
  evidence: Evidence[];
  readOnly: boolean;
  uploading: boolean;
  onChange: (answer: InspectionAnswer) => void;
  onUpload: (file: File) => void;
}) {
  const needsSize = item.requiresSizeWhenAbnormal && answer?.value && answer.value !== '正常';
  const resultClass = !answer?.value ? '' : answer.value === '正常' || ['无故障码', '数据正常'].includes(answer.value) ? 'result-normal' : needsSize && !answer.size ? 'result-pending' : answer.size === 'GREATER_THAN_30' ? 'result-danger' : answer.size === 'LESS_THAN_30' ? 'result-warning' : 'result-abnormal';
  const photos = evidence.filter((entry) => entry.itemKey === item.key);
  function update(patch: Partial<InspectionAnswer>) {
    const next: InspectionAnswer = {
      itemKey: item.key,
      sectionKey,
      value: answer?.value ?? '',
      ...answer,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.value !== undefined) {
      if (patch.value === '正常') delete next.size;
      if (item.requiresNoteWhen && !item.requiresNoteWhen.includes(patch.value) && patch.value !== '自定义') delete next.note;
    }
    onChange(next);
  }
  return <div className="inspection-item" id={`item-${item.key}`}>
    <div className="item-label"><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong>{item.professionalReviewRequired && <small>示范项待专业确认</small>}</div>
    <div className="item-result">
      <select aria-label={`${item.title}检查结果`} className={resultClass} value={answer?.value ?? ''} disabled={readOnly} onChange={(event) => update({ value: event.target.value })}>
        <option value="">待检查</option>
        {item.options.map((option) => <option key={option.value} value={option.value} style={{ color: option.tone === 'green' ? '#376d57' : option.tone === 'dark' ? '#111' : undefined }}>{option.label}</option>)}
      </select>
      {needsSize && <div className="size-control" role="group" aria-label="损伤尺寸判定"><button className={answer?.size === 'GREATER_THAN_30' ? 'selected danger' : ''} disabled={readOnly} onClick={() => update({ size: 'GREATER_THAN_30' })}>大于30cm×30cm</button><button className={answer?.size === 'LESS_THAN_30' ? 'selected warning' : ''} disabled={readOnly} onClick={() => update({ size: 'LESS_THAN_30' })}>小于30cm×30cm</button></div>}
      {answerNeedsNote(item, answer) && <input className="item-note" value={answer?.note ?? ''} disabled={readOnly} onChange={(event) => update({ note: event.target.value })} placeholder={`请填写${item.noteLabel ?? '车况说明'}（必填）`} />}
    </div>
    <div className="item-media">
      <label className={`photo-button ${readOnly ? 'disabled' : ''}`} title="添加现场照片">
        {uploading ? <LoaderCircle className="spin" size={18} /> : photos.length ? <Check size={18} /> : <Camera size={18} />}<span>{uploading ? '上传中' : photos.length ? `${photos.length} 张` : '拍照'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={readOnly || uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} />
      </label>
      {photos.length > 0 && <div className="photo-strip">{photos.map((photo) => <PhotoThumb key={photo.id} assetId={photo.id} previewUrl={photo.previewUrl} />)}</div>}
    </div>
  </div>;
}

function PhotoThumb({ assetId, previewUrl }: { assetId: string; previewUrl: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    api<{ url: string }>(previewUrl).then((result) => setUrl(`${import.meta.env.VITE_API_BASE_URL ?? ''}${result.url}`)).catch(() => undefined);
  }, [assetId, previewUrl]);
  return url ? <a href={url} target="_blank" rel="noreferrer" className="photo-thumb"><img src={url} alt="现场检测照片" loading="lazy" /></a> : <span className="photo-thumb placeholder"><ImagePlus size={15} /></span>;
}
