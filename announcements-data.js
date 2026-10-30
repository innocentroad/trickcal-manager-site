                                            
(function initAnnouncementData(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRICKCAL_ANNOUNCEMENT_DATA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAnnouncementDataApi() {
  'use strict';

  const ALLOWED_PROFILES = new Set(['new', 'legacy']);
  const ALLOWED_CTA = new Set(['migration-guide', null]);
  const ARTICLES = Object.freeze([
    Object.freeze({
      id: '20261031-feature-apostle-bulk-settings',
      date: '2026-10-31',
      title: '使徒設定・全体ボードの一覧操作を改善',
      barTitle: '一覧の一括変更・絞り込みを追加',
      summary: 'SLv・装備の一括変更、並び順の記憶、全体ボードの未塗り絞り込みに対応しました。',
      body: Object.freeze([
        '使徒設定では各使徒の「SLv」「装備」見出しから、SLvのLv4・Lv7・MAX、装備の「なし」・+0～+5を一括適用できます。',
        '変更はすぐ反映され、まとめて取り消し・やり直しできます。個別設定も引き続き利用できます。育成値を変えても使徒の一覧位置は維持されます。',
        '全体ボードに「未塗り優先」「未塗りのみ」を追加しました。現在選択中のボード階層・ステータス条件に合う特殊マスを基準に表示します。',
        'Manager内の各画面で選んだ並び順は、再読み込み後も保持されます。対象は全体ボード・一括設定・Rank／好感度／アサイド一覧・使徒選択・編成時の使徒選択です。',
        '検索文字列や絞り込み条件は保存されません。'
      ]),
      category: 'feature',
      profiles: Object.freeze(['new']),
      autoRevision: '1',
      cta: null
    }),
    Object.freeze({
      id: 'migration-file-first-20260914',
      date: '2026-09-14',
      title: '新サイトへの移行のお知らせ',
      barTitle: '新サイトへの移行について',
      summary: '旧サイトの通常画面は新サイトへ自動転送されます。保存データは「旧データを引き継ぐ」から移行してください。',
      body: Object.freeze([
        '旧サイトの通常画面は、新サイト trickcal.irlab.dev へ自動転送されるようになりました。',
        '保存データは自動では引き継がれません。',
        '「旧データを引き継ぐ」から、旧サイトの専用ページで転送またはバックアップ保存を選べます。',
        '移行済み・初めて利用する方は操作不要です。',
        '旧サイトのデータは残りますが、読み込み先の対象データは上書きされます。'
      ]),
      profileCopy: Object.freeze({
        legacy: Object.freeze({
          title: '新サイトへの移行のお知らせ',
          barTitle: '新サイトへの移行について',
          summary: '旧サイトの通常画面は新サイトへ自動転送されます。保存データは「旧データを引き継ぐ」から移行してください。',
          body: Object.freeze([
            '旧サイトの通常画面は、新サイト trickcal.irlab.dev へ自動転送されるようになりました。',
            '保存データは自動では引き継がれません。',
            '「旧データを引き継ぐ」から、旧サイトの専用ページで転送またはバックアップ保存を選べます。',
            '移行済み・初めて利用する方は操作不要です。',
            '旧サイトのデータは残りますが、読み込み先の対象データは上書きされます。'
          ])
        }),
        new: Object.freeze({
          title: '旧サイトの保存データを引き継ぐ',
          barTitle: '旧サイトの保存データを引き継ぐ',
          summary: '旧サイトの通常画面は新サイトへ自動転送されます。保存データは「旧データを引き継ぐ」から移行してください。',
          body: Object.freeze([
            '旧サイトの通常画面は、このサイトへ自動転送されるようになりました。',
            '保存データは自動では引き継がれません。',
            '「旧データを引き継ぐ」から、旧サイトの専用ページで転送またはバックアップ保存を選べます。',
            '移行済み・初めて利用する方は操作不要です。',
            '旧サイトのデータは残りますが、読み込み先の対象データは上書きされます。'
          ])
        })
      }),
      category: '移行案内',
      profiles: Object.freeze(['new', 'legacy']),
      autoRevision: '1',
      cta: 'migration-guide'
    })
  ]);

  function isValidDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function validateArticle(article, index) {
    const label = `article[${index}]`;
    if (!article || typeof article !== 'object' || Array.isArray(article)) return `${label} is not an object`;
    if (typeof article.id !== 'string' || !article.id.trim()) return `${label}.id is required`;
    if (!isValidDate(article.date)) return `${label}.date is invalid`;
    if (typeof article.title !== 'string' || !article.title.trim()) return `${label}.title is required`;
    if (article.barTitle !== undefined
      && (typeof article.barTitle !== 'string' || !article.barTitle.trim())) return `${label}.barTitle is invalid`;
    if (typeof article.summary !== 'string' || !article.summary.trim()) return `${label}.summary is required`;
    if (!Array.isArray(article.body) || !article.body.length
      || article.body.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim())) {
      return `${label}.body is invalid`;
    }
    if (!Array.isArray(article.profiles) || !article.profiles.length
      || article.profiles.some(profile => !ALLOWED_PROFILES.has(profile))) {
      return `${label}.profiles is invalid`;
    }
    if (article.autoRevision !== undefined
      && (typeof article.autoRevision !== 'string' || !article.autoRevision.trim())) {
      return `${label}.autoRevision is invalid`;
    }
    if (article.profileCopy !== undefined) {
      if (!article.profileCopy || typeof article.profileCopy !== 'object' || Array.isArray(article.profileCopy)) {
        return `${label}.profileCopy is invalid`;
      }
      for (const profile of ['new', 'legacy']) {
        const copy = article.profileCopy[profile];
        if (!copy || typeof copy !== 'object'
          || typeof copy.title !== 'string' || !copy.title.trim()
          || typeof copy.barTitle !== 'string' || !copy.barTitle.trim()
          || typeof copy.summary !== 'string' || !copy.summary.trim()
          || !Array.isArray(copy.body) || !copy.body.length
          || copy.body.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim())) {
          return `${label}.profileCopy.${profile} is invalid`;
        }
      }
    }
    if (!ALLOWED_CTA.has(article.cta === undefined ? null : article.cta)) return `${label}.cta is invalid`;
    return null;
  }

  function validateArticles(input) {
    if (!Array.isArray(input) || !input.length) return { ok: false, errors: ['articles must be a non-empty array'] };
    const errors = [];
    const ids = new Set();
    input.forEach((article, index) => {
      const error = validateArticle(article, index);
      if (error) errors.push(error);
      if (article?.id) {
        if (ids.has(article.id)) errors.push(`duplicate article id: ${article.id}`);
        ids.add(article.id);
      }
    });
    return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
  }

  function normalizeProfile(profile) {
    return profile === 'legacy' ? 'legacy' : 'new';
  }

  function resolveArticle(article, profile = 'new') {
    const copy = article?.profileCopy?.[normalizeProfile(profile)];
    if (!copy) return article;
    return Object.freeze({
      ...article,
      title: copy.title,
      barTitle: copy.barTitle,
      summary: copy.summary,
      body: Object.freeze(copy.body.slice())
    });
  }

  function getArticles(profile = 'new', input = ARTICLES) {
    const normalizedProfile = normalizeProfile(profile);
    return input
      .filter(article => Array.isArray(article.profiles) && article.profiles.includes(normalizedProfile))
      .map(article => resolveArticle(article, normalizedProfile))
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
  }

  function getArticle(id, input = ARTICLES, profile = 'new') {
    const article = input.find(item => item.id === id) || null;
    return article ? resolveArticle(article, profile) : null;
  }

  function getArticleForProfile(id, profile = 'new', input = ARTICLES) {
    return getArticle(id, input, profile);
  }

  const validation = validateArticles(ARTICLES);
  if (!validation.ok) throw new Error(`Invalid announcement data: ${validation.errors.join(', ')}`);

  return Object.freeze({
    version: 1,
    articles: ARTICLES,
    validateArticles,
    getArticles,
    getArticle,
    getArticleForProfile,
    resolveArticle
  });
});
