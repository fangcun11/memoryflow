import { useState, useEffect, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BrainCircuit, Check, X, RotateCcw, BookOpen, ArrowRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../stores/useStore'
import { predictInterval, formatInterval, getShuffledOptions } from '@memoryflow/core'
import type { ReviewRating, Card, CardType } from '@memoryflow/core'

/** 卡片类型徽标配色 */
const TYPE_BADGE: Record<CardType, { label: string; classes: string }> = {
  qa: { label: '问答', classes: 'bg-teal-light text-teal' },
  cloze: { label: '填空', classes: 'bg-amber-light text-amber' },
  essay: { label: '论述', classes: 'bg-success-light text-success' },
  compare: { label: '对比', classes: 'bg-coral-light text-coral' },
  recall: { label: '名解', classes: 'bg-blue-light text-blue' },
  choice: { label: '单选', classes: 'bg-coral-light text-coral' },
  judge: { label: '判断', classes: 'bg-blue-light text-blue' },
}

export default function ReviewView() {
  const {
    cards,
    reviewQueue,
    currentReviewIndex,
    reviewSession,
    startReview,
    rateCard,
    undoLastReview,
    nextCard,
    endReview,
    lastReviewSnapshot,
    getDueCards,
    getNewCards,
    getHardCards,
  } = useStore()

  const navigate = useNavigate()
  const [showComplete, setShowComplete] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [timer, setTimer] = useState(0)

  // 作答状态（刷题式：无翻面、无手势）
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [judgePick, setJudgePick] = useState<boolean | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [easeBoost, setEaseBoost] = useState(false) // 答对后"太简单了"→ 升为「简单」

  const dueCards = getDueCards()
  const newCards = getNewCards()
  const hardCards = getHardCards()

  useEffect(() => {
    if (reviewQueue.length > 0 && currentReviewIndex < reviewQueue.length) {
      const interval = setInterval(() => setTimer(t => t + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [reviewQueue.length, currentReviewIndex])

  const currentCard: Card | undefined = reviewQueue[currentReviewIndex]
  const isComplete = currentReviewIndex >= reviewQueue.length && reviewQueue.length > 0
  const complete = showComplete || isComplete

  // ===== 派生 =====
  const isChoice = currentCard?.type === 'choice'
  const isJudge = currentCard?.type === 'judge'
  const isAnswerType = isChoice || isJudge
  const shuffled =
    isChoice && currentCard?.options ? getShuffledOptions(currentCard) : null
  const answered = isChoice
    ? selectedOption !== null
    : isJudge
    ? judgePick !== null
    : false
  const answeredCorrectly = isChoice
    ? selectedOption === shuffled?.correctIndex
    : isJudge
    ? judgePick === currentCard?.judgeAnswer
    : false
  // 客观题自动判分：对→记得(4)，错→忘记(0)；"太简单了"升为简单(5)
  const effectiveRating = (answeredCorrectly ? (easeBoost ? 5 : 4) : 0) as ReviewRating
  // 判断题正面剥掉"判断："前缀；旧符号剥 ! 前缀
  const judgeStmt = isJudge
    ? (currentCard?.front.startsWith('判断：')
        ? currentCard.front.slice(3)
        : currentCard?.front.replace(/^!\s*~?\s*/, '') ?? '')
    : ''

  const resetForNext = useCallback(() => {
    setSelectedOption(null)
    setJudgePick(null)
    setRevealed(false)
    setEaseBoost(false)
  }, [])

  const advance = useCallback(() => {
    rateCard(effectiveRating)
    setTimeout(() => {
      resetForNext()
      nextCard()
    }, 250)
  }, [rateCard, effectiveRating, resetForNext, nextCard])

  const handleGrade = useCallback(
    (r: ReviewRating) => {
      rateCard(r)
      setTimeout(() => {
        resetForNext()
        nextCard()
      }, 250)
    },
    [rateCard, resetForNext, nextCard]
  )

  const handleUndo = useCallback(() => {
    if (!lastReviewSnapshot) return
    undoLastReview()
    resetForNext()
  }, [lastReviewSnapshot, undoLastReview, resetForNext])

  // 查看来源块：跳到知识库并高亮该块（复习会话保留，返回后可继续）
  const goSourceBlock = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      if (!currentCard) return
      navigate(`/?block=${currentCard.blockId}`)
    },
    [currentCard, navigate]
  )

  // ===== 键盘 =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }
      if (e.key === 'Escape') {
        if (reviewQueue.length > 0 && !showComplete) setShowExitConfirm(v => !v)
        return
      }
      const optionKeys: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }
      if (isAnswerType) {
        if (!answered) {
          const idx = optionKeys[e.key.toLowerCase()]
          if (idx !== undefined && (isChoice || idx < 2)) {
            e.preventDefault()
            if (isChoice) setSelectedOption(idx)
            else setJudgePick(idx === 0)
          }
        } else if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault()
          advance()
        }
      } else {
        if (!revealed) {
          if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault()
            setRevealed(true)
          }
        } else {
          if (e.code === 'Space' || e.key === 'Enter') return // 防误触直接过题
          switch (e.key) {
            case '1': handleGrade(0); break
            case '2': handleGrade(2); break
            case '3': handleGrade(4); break
            case '4': handleGrade(5); break
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isAnswerType, answered, isChoice, revealed, advance, handleGrade, handleUndo, reviewQueue.length, showComplete])

  // ===== 开始页 =====
  if (reviewQueue.length === 0 && !showComplete) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 lg:p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-coral-light flex items-center justify-center mx-auto mb-6">
            <BrainCircuit className="w-10 h-10 text-coral" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-[1.75rem] font-medium text-ink tracking-tight mb-2">开始今日刷题</h2>

          <div className="grid grid-cols-3 gap-3 my-6">
            <StatCard label="待复习" value={dueCards.length} variant="coral" />
            <StatCard label="新题" value={newCards.length} variant="teal" />
            <StatCard label="难题" value={hardCards.length} variant="amber" />
          </div>

          {cards.length === 0 ? (
            <p className="text-sm text-muted mb-6">
              还没有题，先去知识库导入材料并生成吧
            </p>
          ) : dueCards.length + newCards.length === 0 ? (
            <p className="text-sm text-muted mb-6">
              今日刷题已完成，太棒了！
            </p>
          ) : null}

          <button
            onClick={() => {
              setShowComplete(false)
              startReview()
            }}
            disabled={cards.length === 0}
            className="px-8 py-3 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm disabled:opacity-40 active:scale-95"
          >
            开始刷题
          </button>
        </div>
      </div>
    )
  }

  // ===== 完成页 =====
  if (complete) {
    const { reviewed, correct } = reviewSession
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 lg:p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" strokeWidth={2} />
          </div>
          <h2 className="font-serif text-[1.75rem] font-medium text-ink tracking-tight mb-2">本轮完成！</h2>
          <p className="text-sm text-muted mb-6">坚持就是胜利，每天进步一点点</p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatCard label="已刷" value={reviewed} variant="coral" />
            <StatCard label="正确率" value={reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0} suffix="%" variant="teal" />
            <StatCard label="用时" value={formatTime(timer)} isText variant="amber" />
          </div>

          <button
            onClick={() => {
              setShowComplete(false)
              endReview()
            }}
            className="px-8 py-3 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm active:scale-95"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  if (!currentCard) return null

  const progress = ((currentReviewIndex + 1) / reviewQueue.length) * 100

  return (
    <div className="h-full flex flex-col">
      {/* 顶栏：退出 / 进度 / 撤销 / 计时 */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6">
        <div className="flex items-center justify-between text-xs text-muted mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="w-7 h-7 -ml-1.5 rounded-lg hover:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-ink transition-colors"
              title="结束本轮 (Esc)"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
            <span>{currentReviewIndex + 1} / {reviewQueue.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!lastReviewSnapshot}
              className="w-7 h-7 rounded-lg hover:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-ink transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              title="撤销上一题 (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2} />
            </button>
            <span className="pl-1">{formatTime(timer)}</span>
          </div>
        </div>
        <div className="h-1.5 bg-surface-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-coral rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 题目区（刷题页式，无翻面） */}
      <div className="flex-1 overflow-auto p-4 lg:p-8 min-h-0">
        <div
          key={currentReviewIndex}
          className="card-enter max-w-2xl mx-auto bg-surface-card border border-hairline rounded-2xl p-5 lg:p-8"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {/* 题头 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${TYPE_BADGE[currentCard.type].classes}`}>
                {TYPE_BADGE[currentCard.type].label}
              </span>
              {isAnswerType && !answered && (
                <span className="text-xs text-muted-soft">
                  {isChoice ? '点击选项作答' : '判断对错'}
                </span>
              )}
            </div>
            <button
              onClick={goSourceBlock}
              className="inline-flex items-center gap-1 text-xs text-muted-soft hover:text-coral transition-colors"
              title="在知识库中查看并编辑来源块"
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
              来源块
            </button>
          </div>

          {/* 题干 */}
          <p className="text-base lg:text-lg text-ink font-medium leading-relaxed whitespace-pre-wrap mb-4">
            {isJudge ? judgeStmt : currentCard.front}
          </p>

          {/* 选择题选项 */}
          {isChoice && shuffled && (
            <div className="grid gap-2.5">
              {shuffled.options.map((opt, i) => {
                const isCorrect = i === shuffled.correctIndex
                const isSelected = i === selectedOption
                let cls = 'border-hairline bg-canvas hover:border-coral/50 hover:bg-coral-faint'
                if (answered) {
                  if (isCorrect) cls = 'border-success/50 bg-success-light text-success'
                  else if (isSelected) cls = 'border-error/50 bg-error-light text-error'
                  else cls = 'border-hairline bg-canvas opacity-50'
                }
                return (
                  <button
                    key={i}
                    disabled={answered}
                    onClick={() => setSelectedOption(i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all duration-150 active:scale-[0.98] ${cls}`}
                  >
                    <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-medium shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                    {answered && isCorrect && <Check className="w-4 h-4 ml-auto shrink-0" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}

          {/* 判断题 */}
          {isJudge && (
            <div className="grid grid-cols-2 gap-3">
              {([true, false] as const).map(val => {
                const isCorrect = val === currentCard.judgeAnswer
                const isSelected = answered && judgePick === val
                let cls = 'border-hairline bg-canvas hover:border-coral/50 hover:bg-coral-faint'
                if (answered) {
                  if (isCorrect) cls = 'border-success/50 bg-success-light text-success'
                  else if (isSelected) cls = 'border-error/50 bg-error-light text-error'
                  else cls = 'border-hairline bg-canvas opacity-50'
                }
                return (
                  <button
                    key={String(val)}
                    disabled={answered}
                    onClick={() => setJudgePick(val)}
                    className={`py-4 rounded-xl border text-base font-medium transition-all duration-150 active:scale-[0.98] ${cls}`}
                  >
                    {val ? '✓ 正确' : '✗ 错误'}
                  </button>
                )
              })}
            </div>
          )}

          {/* 记忆类：答案区（点击查看） */}
          {!isAnswerType && (
            revealed ? (
              <div
                className="card-enter rounded-xl bg-surface-soft border border-hairline p-4 max-h-72 overflow-auto"
                style={{ touchAction: 'pan-y' }}
              >
                <p className="text-sm text-body leading-relaxed whitespace-pre-wrap select-text">
                  {currentCard.back}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-6 rounded-xl border border-dashed border-muted-soft/40 text-sm text-muted hover:text-coral hover:border-coral/50 transition-colors"
              >
                先在脑中回忆，再点击查看答案（空格）
              </button>
            )
          )}

          {/* 客观题反馈 */}
          {isAnswerType && answered && (
            <div className={`mt-4 rounded-xl px-4 py-3 ${answeredCorrectly ? 'bg-success-light' : 'bg-error-light'}`}>
              <p className={`text-sm font-medium ${answeredCorrectly ? 'text-success' : 'text-error'}`}>
                {answeredCorrectly ? '回答正确' : '回答错误'}
                <span className="ml-2 font-normal opacity-80">
                  {isChoice ? `正确答案：${shuffled?.options[shuffled.correctIndex]}` : `应判：${currentCard.judgeAnswer ? '正确' : '错误'}`}
                </span>
              </p>
              {isChoice && currentCard.back.replace(/^正确答案：[^\n]*\n?/, '') && (
                <p className="text-xs text-body mt-1.5 leading-relaxed whitespace-pre-wrap">
                  {currentCard.back.replace(/^正确答案：[^\n]*\n?/, '')}
                </p>
              )}
              {!answeredCorrectly && (
                <p className="text-[11px] text-muted mt-1">本题已排入本轮末尾，稍后再考一次</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 操作条 */}
      <div className="px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
        <div className="max-w-2xl mx-auto">
          {isAnswerType ? (
            answered ? (
              <div className="flex items-center gap-2">
                {answeredCorrectly && (
                  <button
                    onClick={() => setEaseBoost(true)}
                    disabled={easeBoost}
                    className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all active:scale-95 ${
                      easeBoost
                        ? 'border-success/40 bg-success-light text-success'
                        : 'border-hairline text-muted hover:text-amber hover:border-amber/50'
                    }`}
                    title="答对了但靠提示才想起来时不用点；确实轻松答出可升级为「简单」"
                  >
                    <Zap className="w-4 h-4" strokeWidth={2} />
                    {easeBoost ? '已按「简单」记录' : '太简单了'}
                  </button>
                )}
                <button
                  onClick={advance}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 bg-coral text-on-primary rounded-xl text-sm font-medium hover:bg-coral-active transition-colors shadow-sm active:scale-[0.98]"
                >
                  {answeredCorrectly ? '下一题' : '记住了，下一题'}
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  <span className="ml-1 opacity-60 hidden lg:inline text-xs">[空格]</span>
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-soft py-3">
                点击选项作答 · 键盘 1-4 / A-D 可选
              </p>
            )
          ) : revealed ? (
            <div className="grid grid-cols-4 gap-2 lg:gap-3">
              <RatingButton label="忘记" shortcut="1" interval={predictInterval(currentCard, 0)} variant="error" onClick={() => handleGrade(0)} />
              <RatingButton label="模糊" shortcut="2" interval={predictInterval(currentCard, 2)} variant="amber" onClick={() => handleGrade(2)} />
              <RatingButton label="记得" shortcut="3" interval={predictInterval(currentCard, 4)} variant="teal" onClick={() => handleGrade(4)} />
              <RatingButton label="简单" shortcut="4" interval={predictInterval(currentCard, 5)} variant="success" onClick={() => handleGrade(5)} />
            </div>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-3 bg-coral text-on-primary rounded-xl text-sm font-medium hover:bg-coral-active transition-colors shadow-sm active:scale-[0.98]"
            >
              查看答案
              <span className="ml-1.5 opacity-60 text-xs hidden lg:inline">[空格]</span>
            </button>
          )}
        </div>
      </div>

      {/* 退出确认弹层 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="确认结束刷题">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-surface-card border border-hairline rounded-2xl p-6 max-w-sm w-full text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-serif text-lg font-medium text-ink mb-2">结束本轮刷题？</h3>
            <p className="text-sm text-muted mb-5">已作答的题目会保留记录，剩余的题目不会被计入今日进度。</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="py-2.5 rounded-xl border border-coral/40 text-coral text-sm font-medium hover:bg-coral-faint transition-colors"
              >
                继续刷题
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false)
                  endReview()
                }}
                className="py-2.5 rounded-xl bg-coral text-on-primary text-sm font-medium hover:bg-coral-active transition-colors"
              >
                结束刷题
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, suffix = '', isText = false, variant }: {
  label: string; value: number | string; suffix?: string; isText?: boolean;
  variant: 'coral' | 'teal' | 'amber'
}) {
  const colorMap = {
    coral: 'text-coral',
    teal: 'text-teal',
    amber: 'text-amber',
  }
  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${colorMap[variant]}`}>
        {isText ? value : `${value}${suffix}`}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}

function RatingButton({ label, shortcut, interval, variant, onClick }: {
  label: string; shortcut: string; interval: number;
  variant: 'error' | 'amber' | 'teal' | 'success'; onClick: () => void
}) {
  const variantStyles = {
    error: 'border-error/30 hover:bg-error-light hover:border-error/50 text-error',
    amber: 'border-amber/30 hover:bg-amber-light hover:border-amber/50 text-amber',
    teal: 'border-teal/30 hover:bg-teal-light hover:border-teal/50 text-teal',
    success: 'border-success/30 hover:bg-success-light hover:border-success/50 text-success',
  }

  return (
    <button
      onClick={onClick}
      className={`py-3 px-4 rounded-xl border text-center transition-all duration-150 active:scale-95 bg-canvas ${variantStyles[variant]}`}
    >
      <div className="text-sm font-medium">
        {label}
        <span className="ml-1.5 text-xs opacity-40 hidden lg:inline">[{shortcut}]</span>
      </div>
      <div className="text-xs opacity-60 mt-0.5">{formatInterval(interval)}</div>
    </button>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}
