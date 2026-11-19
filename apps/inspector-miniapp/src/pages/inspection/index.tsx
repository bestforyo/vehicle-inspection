import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import type { InspectionAnswer, TemplateItem } from '@jianjian/contracts';
import { completionCount, getInspectionAlerts, validateInspection } from '@jianjian/templates';
import { ApiError, apiBase, request, showError, uploadPhoto } from '../../api';
import type { Inspection, Order } from '../../types';

interface LocalDraft { lockVersion: number; answers: InspectionAnswer[]; savedAt: string }

export default function InspectionPage() {
  const router = useRouter();
  const orderId = router.params.orderId ?? '';
  const [order, setOrder] = useState<Order>();
  const [inspection, setInspection] = useState<Inspection>();
  const [answers, setAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [activeSection, setActiveSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const storageKey = `jianjian.draft.${orderId}`;

  const applyServer = useCallback((data: Inspection) => {
    setInspection(data);
    setAnswers(Object.fromEntries(data.answers.map((answer) => [answer.itemKey, answer])));
    setActiveSection((current) => current || data.template.sections[0]?.key || '');
  }, []);

  const load = useCallback(async () => {
    try {
      const [orderData, inspectionData] = await Promise.all([request<Order>(`/api/v1/orders/${orderId}`), request<Inspection>(`/api/v1/orders/${orderId}/inspection/current`)]);
      setOrder(orderData);
      applyServer(inspectionData);
      const local = Taro.getStorageSync(storageKey) as LocalDraft | '';
      if (local && local.answers?.length) {
        const choice = await Taro.showModal({ title: local.lockVersion === inspectionData.lockVersion ? '发现未同步草稿' : '草稿版本不一致', content: local.lockVersion === inspectionData.lockVersion ? '是否恢复本机暂存的检测结果？' : '服务端已有更新。请选择使用本机副本或服务端版本，本机副本不会被静默删除。', confirmText: '使用本机', cancelText: '用服务端' });
        if (choice.confirm) setAnswers(Object.fromEntries(local.answers.map((answer) => [answer.itemKey, answer])));
      }
    } catch (cause) { showError(cause); }
  }, [orderId, applyServer, storageKey]);
  useEffect(() => { if (orderId) load(); }, [load]);

  const answerList = useMemo(() => Object.values(answers), [answers]);
  const alerts = useMemo(() => inspection ? getInspectionAlerts(inspection.template, answerList) : undefined, [inspection, answerList]);
  const section = inspection?.template.sections.find((entry) => entry.key === activeSection) ?? inspection?.template.sections[0];
  const readOnly = inspection?.status !== 'DRAFT';

  function update(item: TemplateItem, sectionKey: string, patch: Partial<InspectionAnswer>) {
    if (readOnly) return;
    setAnswers((current) => {
      const previous = current[item.key];
      const next: InspectionAnswer = { ...previous, itemKey: item.key, sectionKey, value: previous?.value ?? '', ...patch, updatedAt: new Date().toISOString() };
      if (patch.value === '正常') delete next.size;
      if (patch.value && item.requiresNoteWhen && !item.requiresNoteWhen.includes(patch.value) && patch.value !== '自定义') delete next.note;
      const result = { ...current, [item.key]: next };
      Taro.setStorageSync(storageKey, { lockVersion: inspection?.lockVersion, answers: Object.values(result), savedAt: new Date().toISOString() } satisfies LocalDraft);
      return result;
    });
  }

  async function save() {
    if (!inspection || readOnly) return inspection;
    setSaving(true);
    try {
      const result = await request<Inspection>(`/api/v1/orders/${orderId}/inspection/draft`, 'PUT', { lockVersion: inspection.lockVersion, answers: Object.values(answers) });
      setInspection(result);
      Taro.removeStorageSync(storageKey);
      Taro.showToast({ title: '草稿已保存', icon: 'success' });
      return result;
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'REVISION_CONFLICT') {
        const choice = await Taro.showModal({ title: '服务端版本已更新', content: '本机草稿已保留。重新加载后可人工核对并重新填写，是否加载服务端版本？', confirmText: '重新加载' });
        if (choice.confirm) await load();
      } else showError(cause);
      throw cause;
    } finally { setSaving(false); }
  }

  async function choosePhoto(item: TemplateItem) {
    if (readOnly) return;
    try {
      if (!answers[item.key]?.value) { Taro.showToast({ title: '请先选择检查结果', icon: 'none' }); return; }
      await save();
      const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['camera', 'album'] });
      let filePath = selected.tempFilePaths[0];
      const info = await Taro.getImageInfo({ src: filePath });
      if (Math.max(info.width, info.height) > 1440) {
        const scale = 1440 / Math.max(info.width, info.height);
        const compressed = await Taro.compressImage({ src: filePath, quality: 76, compressedWidth: Math.round(info.width * scale), compressedHeight: Math.round(info.height * scale) });
        filePath = compressed.tempFilePath;
      }
      setUploading(item.key);
      await uploadPhoto('/api/v1/media/upload', filePath, orderId, item.key);
      const refreshed = await request<Inspection>(`/api/v1/orders/${orderId}/inspection/current`);
      applyServer(refreshed);
      Taro.showToast({ title: '照片已上传', icon: 'success' });
    } catch (cause) { if ((cause as { errMsg?: string }).errMsg?.includes('cancel')) return; showError(cause); } finally { setUploading(''); }
  }

  async function submit() {
    if (!inspection) return;
    try {
      const saved = await save();
      const issues = validateInspection(inspection.template, Object.values(answers));
      if (issues.length) {
        setActiveSection(issues[0].sectionKey);
        Taro.showModal({ title: '暂不能提交', content: issues[0].message, showCancel: false });
        return;
      }
      const choice = await Taro.showModal({ title: '提交机构审核', content: '提交后当前检测版本将冻结，是否继续？' });
      if (!choice.confirm) return;
      await request(`/api/v1/orders/${orderId}/inspection/submit`, 'POST', { lockVersion: saved?.lockVersion });
      Taro.showToast({ title: '已提交审核', icon: 'success' });
      setTimeout(() => Taro.switchTab({ url: '/pages/reviews/index' }), 800);
    } catch (cause) { showError(cause); }
  }

  if (!inspection || !order || !section) return <View className='empty'>正在加载检测模板与草稿…</View>;
  const total = inspection.template.sections.reduce((sum, entry) => sum + entry.items.length, 0);
  const completed = completionCount(inspection.template, answerList);
  return <View className='page'>
    <Text className='eyebrow'>{order.orderNo} / REVISION V{inspection.revisionNumber}</Text><Text className='page-title'>{order.standard === 'NATIONAL' ? '国标' : '团标'} · {order.packageName}</Text><View className='row'><Text className='page-desc'>{completed} / {total} 项已完成</Text><Button className='secondary' style={{ minHeight: '64px' }} onClick={() => Taro.navigateTo({ url: `/pages/vehicle/index?orderId=${orderId}` })}>车辆资料</Button></View><View className='progress'><View className='progress-inner' style={{ width: `${completed / total * 100}%` }} /></View>
    {alerts?.accident && <View className='alert'>事故车提示：{alerts.accidentCount} 个关键决定项损伤大于30cm×30cm，请复核异常结果和照片。</View>}{alerts?.water && <View className='alert'>泡水车提示：{alerts.waterCount} 个重点项目选择水渍泥沙，请复核说明和照片。</View>}{alerts?.fire && <View className='alert'>火烧车提示：发现烧蚀、熏黑碳化或炙烤融化结果。</View>}
    <ScrollView scrollX className='chapter-scroll' enhanced showScrollbar={false}>{inspection.template.sections.map((entry) => <View key={entry.key} className={`chapter-tab ${activeSection === entry.key ? 'active' : ''}`} onClick={() => setActiveSection(entry.key)}><Text className='chapter-name'>{entry.title}</Text><Text className='chapter-count'>{entry.items.filter((item) => answers[item.key]?.value).length} / {entry.items.length} 项</Text></View>)}</ScrollView>
    <View className='notice'>{section.guidance || '逐项选择实际车况；异常结果必须添加现场照片。'} {saving ? '正在保存…' : '变更会暂存本机，联网后保存服务端。'}</View>
    {section.items.map((item, index) => {
      const answer = answers[item.key];
      const needsSize = item.requiresSizeWhenAbnormal && answer?.value && answer.value !== '正常';
      const needsNote = answer?.value === '自定义' || item.requiresNoteWhen?.includes(answer?.value ?? '');
      return <View className='inspection-item' key={item.key}><View className='inspection-item-title'><Text className='item-index'>{String(index + 1).padStart(2, '0')}</Text><Text>{item.title}</Text></View><View className='option-grid'>{item.options.map((option) => <Button key={option.value} disabled={readOnly} className={`option ${answer?.value === option.value ? 'selected' : ''} ${answer?.value === option.value && !['正常', '无故障码', '数据正常'].includes(option.value) ? 'abnormal' : ''}`} onClick={() => update(item, section.key, { value: option.value })}>{option.label}</Button>)}</View>{needsSize && <View className='option-grid size-options'><Button disabled={readOnly} className={`option ${answer.size === 'GREATER_THAN_30' ? 'selected' : ''}`} onClick={() => update(item, section.key, { size: 'GREATER_THAN_30' })}>大于30cm×30cm</Button><Button disabled={readOnly} className={`option ${answer.size === 'LESS_THAN_30' ? 'selected' : ''}`} onClick={() => update(item, section.key, { size: 'LESS_THAN_30' })}>小于30cm×30cm</Button></View>}{needsNote && <Input className='input' style={{ marginTop: '18px' }} disabled={readOnly} value={answer.note ?? ''} placeholder={`请填写${item.noteLabel ?? '车况说明'}（必填）`} onInput={(event) => update(item, section.key, { note: event.detail.value })} />}<EvidencePhotos inspection={inspection} itemKey={item.key} /><Button className='secondary photo-button' disabled={readOnly} loading={uploading === item.key} onClick={() => choosePhoto(item)}>{uploading === item.key ? '正在上传照片' : '拍照 / 从相册选择'}</Button></View>;
    })}
    {!readOnly && <><Button className='secondary full-button' loading={saving} onClick={save}>保存草稿</Button><Button className='primary full-button' loading={saving} onClick={submit}>提交机构审核</Button></>}
  </View>;
}

function EvidencePhotos({ inspection, itemKey }: { inspection: Inspection; itemKey: string }) {
  const photos = inspection.evidence.filter((entry) => entry.itemKey === itemKey);
  return <View>{photos.map((photo) => <EvidenceImage key={photo.id} assetId={photo.id} previewUrl={photo.previewUrl} />)}</View>;
}

function EvidenceImage({ assetId, previewUrl }: { assetId: string; previewUrl: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { request<{ url: string }>(previewUrl).then((result) => setSrc(`${apiBase()}${result.url}`)).catch(() => undefined); }, [assetId, previewUrl]);
  return src ? <Image className='photo-preview' src={src} mode='aspectFill' lazyLoad onClick={() => Taro.previewImage({ urls: [src] })} /> : null;
}
