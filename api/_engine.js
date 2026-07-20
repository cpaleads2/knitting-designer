// Общая логика расчёта рядов — зеркало того, что уже работает в index.html на клиенте.
// Используется бэкендом при сборке PDF, чтобы цифры в PDF всегда совпадали с тем,
// что пользователь видел на экране.

const VOCAB = {
  en: { sc: 'sc', ch: 'ch' },
  ru: { sc: 'сбн', ch: 'возд.п.' },
  uk: { sc: 'ст.б/н', ch: 'п.п.' }
};

function r2(x) { return Math.round((x || 0) * 100) / 100; }

function ringLine(lang) {
  const v = VOCAB[lang];
  return { en: `6 ${v.sc} in magic ring (6)`, ru: `6 ${v.sc} в кольцо амигуруми (6)`, uk: `6 ${v.sc} в кільце амігурумі (6)` }[lang];
}
function incText(i, lang) {
  const v = VOCAB[lang], rep = i - 2;
  return {
    en: rep <= 0 ? '(inc) x6' : `(${rep} ${v.sc}, inc) x6`,
    ru: rep <= 0 ? '(прибавка) x6' : `(${rep} ${v.sc}, прибавка) x6`,
    uk: rep <= 0 ? '(прибавка) x6' : `(${rep} ${v.sc}, прибавка) x6`
  }[lang];
}
function decText(i, lang) {
  const v = VOCAB[lang], rep = i - 2;
  return {
    en: rep <= 0 ? '(dec) x6' : `(${rep} ${v.sc}, dec) x6`,
    ru: rep <= 0 ? '(убавка) x6' : `(${rep} ${v.sc}, убавка) x6`,
    uk: rep <= 0 ? '(убавка) x6' : `(${rep} ${v.sc}, убавка) x6`
  }[lang];
}
function aroundText(maxSt, lang) {
  const v = VOCAB[lang];
  return { en: `${v.sc} around (${maxSt})`, ru: `${v.sc} по кругу (${maxSt})`, uk: `${v.sc} по колу (${maxSt})` }[lang];
}

function incInfo(diameterCm, stPer10) {
  const stPerCm = stPer10 / 10;
  const circumference = Math.PI * diameterCm;
  let maxSt = Math.round((circumference * stPerCm) / 6) * 6;
  if (maxSt < 6) maxSt = 6;
  return { maxSt, incRounds: maxSt / 6 };
}

function computeOval(lengthCm, widthCm, stg, rowg, lang) {
  const v = VOCAB[lang];
  const stPerCm = stg / 10;
  const straightSts = Math.max(2, Math.round((lengthCm - widthCm) * stPerCm));
  const widthRounds = Math.max(1, Math.round((widthCm * stPerCm) / 4));
  const rounds = []; let n = 1;
  let count = straightSts * 2 + 6;
  const chainTpl = {
    en: `chain ${straightSts + 1}; work around: ${straightSts} ${v.sc}, 3 ${v.sc} in last st, ${straightSts} ${v.sc} along other side, 3 ${v.sc} in first st (${count})`,
    ru: `цепочка из ${straightSts + 1} возд.п.; по кругу: ${straightSts} сбн, 3 сбн в последнюю петлю, ${straightSts} сбн по другой стороне, 3 сбн в первую петлю (${count})`,
    uk: `ланцюжок з ${straightSts + 1} п.п.; по колу: ${straightSts} ст.б/н, 3 ст.б/н в останню петлю, ${straightSts} ст.б/н по іншій стороні, 3 ст.б/н в першу петлю (${count})`
  };
  rounds.push({ n: n++, text: chainTpl[lang] });
  for (let i = 1; i < widthRounds; i++) {
    count += 4;
    const incTpl = {
      en: `inc, ${straightSts} ${v.sc}, inc x2, ${straightSts} ${v.sc}, inc (${count})`,
      ru: `прибавка, ${straightSts} сбн, прибавка x2, ${straightSts} сбн, прибавка (${count})`,
      uk: `прибавка, ${straightSts} ст.б/н, прибавка x2, ${straightSts} ст.б/н, прибавка (${count})`
    };
    rounds.push({ n: n++, text: incTpl[lang] });
  }
  return { rounds, maxSt: count, total: rounds.length };
}

function computePanel(widthCm, heightCm, stg, rowg, lang) {
  const v = VOCAB[lang];
  const stPerCm = stg / 10, rowPerCm = rowg / 10;
  const widthSts = Math.max(2, Math.round(widthCm * stPerCm));
  const heightRows = Math.max(1, Math.round(heightCm * rowPerCm));
  const rounds = []; let n = 1;
  const chainTpl = { en: `chain ${widthSts + 1}`, ru: `цепочка из ${widthSts + 1} возд.п.`, uk: `ланцюжок з ${widthSts + 1} п.п.` };
  rounds.push({ n: n++, text: chainTpl[lang] });
  const rowTpl = {
    en: `row of ${v.sc}, ${widthSts} sts, turn`,
    ru: `ряд сбн по ${widthSts} петель, повернуть вязание`,
    uk: `ряд ст.б/н, ${widthSts} петель, повернути в’язання`
  };
  for (let r = 0; r < heightRows; r++) rounds.push({ n: n++, text: rowTpl[lang] });
  return { rounds, maxSt: widthSts, total: rounds.length };
}

function computePart(p, stg, rowg, lang) {
  if (p.type === 'oval') return computeOval(p.length || 3, p.width || 1.5, stg, rowg, lang);
  if (p.type === 'panel') return computePanel(p.length || 3, p.width || 3, stg, rowg, lang);

  const { maxSt, incRounds } = incInfo(p.diam || 3, stg);
  const rounds = []; let n = 1;
  rounds.push({ n: n++, text: ringLine(lang) });
  for (let i = 2; i <= incRounds; i++) rounds.push({ n: n++, text: incText(i, lang) + ` (${6 * i})` });
  if (p.type === 'disc') return { rounds, maxSt, total: rounds.length };

  const rowPerCm = rowg / 10;
  const straight = Math.max(0, Math.round((p.extra || 0) * rowPerCm));
  for (let j = 0; j < straight; j++) rounds.push({ n: n++, text: aroundText(maxSt, lang) });
  if (p.type === 'cylinder') return { rounds, maxSt, total: rounds.length };

  if (p.type === 'sphere') { for (let i = incRounds; i >= 2; i--) rounds.push({ n: n++, text: decText(i, lang) + ` (${6 * (i - 1)})` }); }
  else if (p.type === 'cone') { for (let i = incRounds; i >= 2; i -= 2) rounds.push({ n: n++, text: decText(i, lang) + ` (${6 * (i - 1)})` }); }
  return { rounds, maxSt, total: rounds.length };
}

const PDF_TEXT = {
  en: {
    materialsHeader: 'Materials and gauge', legendHeader: 'Abbreviations', partsHeader: 'Parts',
    decorHeader: 'Decorative elements', decorNote: 'These are not crocheted as separate round pieces — assembled or sewn on after the toy is finished.',
    param: 'Parameter', value: 'Value', heightRow: 'Desired toy height', gaugeRow: 'Gauge',
    yarnRow: 'Yarn', yarnVal: 'worsted weight for toys (match to the gauge below)',
    hookRow: 'Hook', hookVal: 'match to your yarn gauge',
    stuffRow: 'Stuffing', stuffVal: 'polyester fiberfill',
    extraRow: 'Extras', extraVal: 'safety eyes, embroidery floss',
    disclaimer: 'This is a draft pattern generated automatically from a photo. Before crocheting, make a 10x10 cm gauge swatch and compare your gauge with the one below - part sizes are calculated for this exact gauge.',
    legend: [['magic ring', 'adjustable starting loop'], ['sc', 'single crochet'], ['ch', 'chain'], ['inc', '2 sc in one stitch'], ['dec', '2 stitches worked together'], ['(...)', 'stitch count at end of round']],
    typeLabels: { sphere: 'sphere', cylinder: 'cylinder', disc: 'disc', cone: 'cone', oval: 'oval', panel: 'panel' },
    pc: 'pc(s)', maxSt: 'max stitches', footer: 'Generated automatically - for personal use'
  },
  ru: {
    materialsHeader: 'Материалы и плотность вязания', legendHeader: 'Условные обозначения', partsHeader: 'Детали',
    decorHeader: 'Декоративные элементы', decorNote: 'Эти элементы не вяжутся отдельными деталями по кругу — собираются или пришиваются после сборки игрушки.',
    param: 'Параметр', value: 'Значение', heightRow: 'Желаемый рост игрушки', gaugeRow: 'Плотность вязания',
    yarnRow: 'Пряжа', yarnVal: 'для игрушек (подберите под указанную плотность)',
    hookRow: 'Крючок', hookVal: 'подберите под плотность на этикетке пряжи',
    stuffRow: 'Наполнитель', stuffVal: 'холлофайбер или синтепух',
    extraRow: 'Дополнительно', extraVal: 'глаза-кнопки, нить для вышивки мулине',
    disclaimer: 'Это черновая схема, сгенерированная автоматически по фото. Перед вязанием обязательно свяжите контрольный образец 10x10 см и сверьте свою плотность вязания с указанной ниже — размеры деталей рассчитаны именно под неё.',
    legend: [['КА', 'кольцо амигуруми'], ['сбн', 'столбик без накида'], ['вп', 'воздушная петля'], ['пр / прибавка', '2 сбн в одну петлю'], ['уб / убавка', '2 петли провязать вместе'], ['(…)', 'количество петель в конце ряда']],
    typeLabels: { sphere: 'шар', cylinder: 'цилиндр', disc: 'диск', cone: 'конус', oval: 'овал', panel: 'полотно' },
    pc: 'шт', maxSt: 'максимум петель', footer: 'Сгенерировано автоматически - для личного использования'
  },
  uk: {
    materialsHeader: 'Матеріали і щільність в’язання', legendHeader: 'Умовні позначення', partsHeader: 'Деталі',
    decorHeader: 'Декоративні елементи', decorNote: 'Ці елементи не в’яжуться окремими деталями по колу — збираються або пришиваються після складання іграшки.',
    param: 'Параметр', value: 'Значення', heightRow: 'Бажаний зріст іграшки', gaugeRow: 'Щільність в’язання',
    yarnRow: 'Пряжа', yarnVal: 'для іграшок (підберіть під зазначену щільність)',
    hookRow: 'Гачок', hookVal: 'підберіть під щільність на етикетці пряжі',
    stuffRow: 'Наповнювач', stuffVal: 'холофайбер або синтепух',
    extraRow: 'Додатково', extraVal: 'очі-гудзики, нитка для вишивки мулине',
    disclaimer: 'Це чорнова схема, згенерована автоматично за фото. Перед в’язанням обов’язково зв’яжіть контрольний зразок 10x10 см і звірте свою щільність в’язання із зазначеною нижче — розміри деталей розраховані саме під неї.',
    legend: [['КА', 'кільце амігурумі'], ['ст.б/н', 'стовпчик без накиду'], ['п.п.', 'повітряна петля'], ['пр / прибавка', '2 ст.б/н в одну петлю'], ['уб / убавка', '2 петлі провязати разом'], ['(…)', 'кількість петель в кінці ряду']],
    typeLabels: { sphere: 'куля', cylinder: 'циліндр', disc: 'диск', cone: 'конус', oval: 'овал', panel: 'полотно' },
    pc: 'шт', maxSt: 'максимум петель', footer: 'Згенеровано автоматично - для особистого використання'
  }
};

module.exports = { computePart, PDF_TEXT, r2 };
