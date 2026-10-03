import type { Domain } from '../domain/types'
import type { Language } from './language'

export interface Copy {
  app: {
    title: string
    navToday: string
    navStats: string
    navForecasts: string
    navLibrary: string
    languageLabel: string
  }
  common: {
    error: string
    retry: string
    yes: string
    no: string
    loading: string
    insufficientData: string
    apply: string
  }
  domainLabels: Record<Domain, string>
  today: {
    title: string
    taskCounter: (index: number, total: number) => string
    loading: string
    unavailable: string
    settingsTitle: string
    minDifficultyLabel: string
    includeWarmupLabel: string
    domainsLabel: string
    applySettingsButton: string
    settingsHint: string
    openSettingsButton: string
    hideSettingsButton: string
    fact: string
    probabilityLabel: string
    probabilityAria: string
    probabilityMeaningFalse: string
    probabilityMeaningUnknown: string
    probabilityMeaningTrue: string
    rationaleLabel: string
    rationalePlaceholder: string
    saveButton: string
    savingButton: string
    nextButton: string
    detailsPrefix: string
    sessionCompleteTitle: string
    sessionCompleteText: string
    startNewSession: string
    factTrueTitle: string
    factFalseTitle: string
    factSummary: (probabilityPercent: number, score: number) => string
    errorLoad: string
    errorSave: string
    errorNoEligibleFacts: string
  }
  stats: {
    title: string
    loading: string
    errorLoad: string
    brierOverall: string
    brier7d: string
    brier30d: string
    brier90d: string
    calibrationTitle: string
    confidenceDistributionTitle: string
    byDomainTitle: string
    domainFilterLabel: string
    domainAll: string
    domainColumn: string
    bin: string
    n: string
    meanP: string
    empirical: string
    delta: string
    pBucket: string
  }
  forecasts: {
    title: string
    loading: string
    promptLabel: string
    promptPlaceholder: string
    resolveAtLabel: string
    probabilityLabel: string
    rationaleLabel: string
    addButton: string
    savingButton: string
    activeTitle: string
    noActive: string
    resolvedTitle: string
    noResolved: string
    resolveAt: string
    resolutionAvailableAfter: string
    resolveYes: string
    resolveNo: string
    outcome: string
    errorLoad: string
    errorCreate: string
    errorResolve: string
    errorPromptEmpty: string
    errorResolveDateInvalid: string
  }
  library: {
    title: string
    loading: string
    errorLoad: string
    factQuestions: string
    factSample: string
    answer: string
    trueLabel: string
    falseLabel: string
  }
  result: {
    title: string
    loading: string
    noData: string
    created: string
    confidence: string
    type: string
    statusPending: string
    outcome: string
    brierError: string
    rationale: string
    backToday: string
    openStats: string
    errorMissingId: string
    errorNotFound: string
    errorLoad: string
  }
}

export const copyByLanguage: Record<Language, Copy> = {
  en: {
    app: {
      title: 'Confidence Trainer',
      navToday: 'Today',
      navStats: 'Stats',
      navForecasts: 'Forecasts',
      navLibrary: 'Library',
      languageLabel: 'Language',
    },
    common: {
      error: 'Error',
      retry: 'Retry',
      yes: 'Yes',
      no: 'No',
      loading: 'Loading...',
      insufficientData: 'insufficient data',
      apply: 'Apply',
    },
    domainLabels: {
      animals: 'Animals',
      history: 'History',
      geography: 'Geography',
      science: 'Science',
      culture: 'Culture',
      tech: 'Tech',
      economy: 'Economy',
    },
    today: {
      title: 'Today',
      taskCounter: (index, total) => `Task ${index} / ${total}`,
      loading: 'Loading today session...',
      unavailable: 'Session unavailable.',
      settingsTitle: 'Session settings',
      minDifficultyLabel: 'Minimum difficulty',
      includeWarmupLabel: 'Include warmup questions',
      domainsLabel: 'Enabled domains',
      applySettingsButton: 'Apply settings',
      settingsHint: 'By default, the session includes non-warmup fact questions with difficulty >= 3.',
      openSettingsButton: 'Settings',
      hideSettingsButton: 'Hide settings',
      fact: 'Fact',
      probabilityLabel: 'Probability (%)',
      probabilityAria: 'Probability percent',
      probabilityMeaningFalse: '0 = fully sure the statement is false',
      probabilityMeaningUnknown: '50 = unsure',
      probabilityMeaningTrue: '100 = fully sure the statement is true',
      rationaleLabel: 'Why (optional, max 200)',
      rationalePlaceholder: 'Short rationale',
      saveButton: 'Submit',
      savingButton: 'Saving...',
      nextButton: 'Next',
      detailsPrefix: 'Full details:',
      sessionCompleteTitle: 'Session complete',
      sessionCompleteText: 'You finished all 10 tasks for today.',
      startNewSession: 'Start new session',
      factTrueTitle: 'True statement',
      factFalseTitle: 'False statement',
      factSummary: (probabilityPercent, score) =>
        `You set ${probabilityPercent}%. Brier error: ${score.toFixed(3)}.`,
      errorLoad: 'Failed to load today session',
      errorSave: 'Failed to save response',
      errorNoEligibleFacts:
        'No fact questions match current filters. Lower difficulty or enable more domains.',
    },
    stats: {
      title: 'Stats',
      loading: 'Loading stats...',
      errorLoad: 'Failed to load stats',
      brierOverall: 'Brier overall',
      brier7d: 'Brier 7d',
      brier30d: 'Brier 30d',
      brier90d: 'Brier 90d',
      calibrationTitle: 'Calibration bins',
      confidenceDistributionTitle: 'Confidence distribution',
      byDomainTitle: 'By domain',
      domainFilterLabel: 'Domain filter',
      domainAll: 'All domains',
      domainColumn: 'Domain',
      bin: 'Bin',
      n: 'n',
      meanP: 'meanP',
      empirical: 'empirical',
      delta: 'delta',
      pBucket: 'P bucket',
    },
    forecasts: {
      title: 'Forecasts',
      loading: 'Loading forecasts...',
      promptLabel: 'Prompt',
      promptPlaceholder: 'Binary event statement',
      resolveAtLabel: 'Resolve at',
      probabilityLabel: 'Probability (%)',
      rationaleLabel: 'Rationale (optional)',
      addButton: 'Add forecast',
      savingButton: 'Saving...',
      activeTitle: 'Active forecasts',
      noActive: 'No active forecasts.',
      resolvedTitle: 'Resolved forecasts',
      noResolved: 'No resolved forecasts yet.',
      resolveAt: 'Resolve at',
      resolutionAvailableAfter: 'Resolution available after resolve date.',
      resolveYes: 'Resolve Yes',
      resolveNo: 'Resolve No',
      outcome: 'Outcome',
      errorLoad: 'Failed to load forecasts',
      errorCreate: 'Failed to create forecast',
      errorResolve: 'Failed to resolve forecast',
      errorPromptEmpty: 'Forecast prompt cannot be empty',
      errorResolveDateInvalid: 'Resolve date is invalid',
    },
    library: {
      title: 'Library',
      loading: 'Loading question library...',
      errorLoad: 'Failed to load library',
      factQuestions: 'Fact questions',
      factSample: 'Fact sample',
      answer: 'Answer',
      trueLabel: 'True',
      falseLabel: 'False',
    },
    result: {
      title: 'Result',
      loading: 'Loading result...',
      noData: 'No result data.',
      created: 'Created',
      confidence: 'Confidence',
      type: 'Type',
      statusPending: 'Status: pending resolution',
      outcome: 'Outcome',
      brierError: 'Brier error',
      rationale: 'Rationale',
      backToday: 'Back to Today',
      openStats: 'Open Stats',
      errorMissingId: 'Missing response id',
      errorNotFound: 'Response not found',
      errorLoad: 'Failed to load result',
    },
  },
  ru: {
    app: {
      title: 'Тренажер калибровки',
      navToday: 'Сегодня',
      navStats: 'Статистика',
      navForecasts: 'Прогнозы',
      navLibrary: 'Банк',
      languageLabel: 'Язык',
    },
    common: {
      error: 'Ошибка',
      retry: 'Повторить',
      yes: 'Да',
      no: 'Нет',
      loading: 'Загрузка...',
      insufficientData: 'недостаточно данных',
      apply: 'Применить',
    },
    domainLabels: {
      animals: 'Животные',
      history: 'История',
      geography: 'География',
      science: 'Наука',
      culture: 'Культура',
      tech: 'Технологии',
      economy: 'Экономика',
    },
    today: {
      title: 'Сегодня',
      taskCounter: (index, total) => `Задание ${index} / ${total}`,
      loading: 'Загрузка сессии на сегодня...',
      unavailable: 'Сессия недоступна.',
      settingsTitle: 'Настройки сессии',
      minDifficultyLabel: 'Минимальная сложность',
      includeWarmupLabel: 'Включить разминку',
      domainsLabel: 'Домены',
      applySettingsButton: 'Применить настройки',
      settingsHint: 'По умолчанию выбираются факты без разминки со сложностью >= 3.',
      openSettingsButton: 'Настройки',
      hideSettingsButton: 'Скрыть настройки',
      fact: 'Факт',
      probabilityLabel: 'Вероятность (%)',
      probabilityAria: 'Вероятность в процентах',
      probabilityMeaningFalse: '0 = полностью уверен, что утверждение ложно',
      probabilityMeaningUnknown: '50 = не знаю',
      probabilityMeaningTrue: '100 = полностью уверен, что утверждение истинно',
      rationaleLabel: 'Почему так думаю (опционально, до 200)',
      rationalePlaceholder: 'Короткое обоснование',
      saveButton: 'Отправить',
      savingButton: 'Сохранение...',
      nextButton: 'Дальше',
      detailsPrefix: 'Полные детали:',
      sessionCompleteTitle: 'Сессия завершена',
      sessionCompleteText: 'Вы прошли все 10 заданий на сегодня.',
      startNewSession: 'Начать новую сессию',
      factTrueTitle: 'Утверждение верно',
      factFalseTitle: 'Утверждение неверно',
      factSummary: (probabilityPercent, score) =>
        `Вы поставили ${probabilityPercent}%. Ошибка Brier: ${score.toFixed(3)}.`,
      errorLoad: 'Не удалось загрузить сессию на сегодня',
      errorSave: 'Не удалось сохранить ответ',
      errorNoEligibleFacts:
        'Нет вопросов под текущие фильтры. Понизьте сложность или включите больше доменов.',
    },
    stats: {
      title: 'Статистика',
      loading: 'Загрузка статистики...',
      errorLoad: 'Не удалось загрузить статистику',
      brierOverall: 'Brier общий',
      brier7d: 'Brier 7д',
      brier30d: 'Brier 30д',
      brier90d: 'Brier 90д',
      calibrationTitle: 'Калибровка по корзинам',
      confidenceDistributionTitle: 'Распределение вероятностей',
      byDomainTitle: 'По доменам',
      domainFilterLabel: 'Фильтр домена',
      domainAll: 'Все домены',
      domainColumn: 'Домен',
      bin: 'Корзина',
      n: 'n',
      meanP: 'meanP',
      empirical: 'empirical',
      delta: 'delta',
      pBucket: 'Корзина p',
    },
    forecasts: {
      title: 'Прогнозы',
      loading: 'Загрузка прогнозов...',
      promptLabel: 'Формулировка',
      promptPlaceholder: 'Бинарное событие',
      resolveAtLabel: 'Дата проверки',
      probabilityLabel: 'Вероятность (%)',
      rationaleLabel: 'Обоснование (опционально)',
      addButton: 'Добавить прогноз',
      savingButton: 'Сохранение...',
      activeTitle: 'Активные прогнозы',
      noActive: 'Нет активных прогнозов.',
      resolvedTitle: 'Закрытые прогнозы',
      noResolved: 'Пока нет закрытых прогнозов.',
      resolveAt: 'Дата проверки',
      resolutionAvailableAfter: 'Закрытие станет доступно после даты проверки.',
      resolveYes: 'Закрыть Да',
      resolveNo: 'Закрыть Нет',
      outcome: 'Исход',
      errorLoad: 'Не удалось загрузить прогнозы',
      errorCreate: 'Не удалось создать прогноз',
      errorResolve: 'Не удалось закрыть прогноз',
      errorPromptEmpty: 'Формулировка прогноза не может быть пустой',
      errorResolveDateInvalid: 'Некорректная дата проверки',
    },
    library: {
      title: 'Банк вопросов',
      loading: 'Загрузка банка вопросов...',
      errorLoad: 'Не удалось загрузить банк',
      factQuestions: 'Вопросов',
      factSample: 'Примеры вопросов',
      answer: 'Ответ',
      trueLabel: 'Верно',
      falseLabel: 'Неверно',
    },
    result: {
      title: 'Результат',
      loading: 'Загрузка результата...',
      noData: 'Нет данных результата.',
      created: 'Создано',
      confidence: 'Уверенность',
      type: 'Тип',
      statusPending: 'Статус: ожидание закрытия',
      outcome: 'Исход',
      brierError: 'Ошибка Brier',
      rationale: 'Обоснование',
      backToday: 'Назад в Сегодня',
      openStats: 'Открыть статистику',
      errorMissingId: 'Не указан id ответа',
      errorNotFound: 'Ответ не найден',
      errorLoad: 'Не удалось загрузить результат',
    },
  },
}
