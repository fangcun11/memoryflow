import { useState, useEffect, useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import { BrainCircuit, Check, ArrowLeftRight, X, RotateCcw, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../stores/useStore'
import { predictInterval, formatInterval, getShuffledOptions } from '@memoryflow/core'
import type { ReviewRating, Card, CardType } from '@memoryflow/core'

/** 上滑/下滑评分的触发阈值（px） */
const SWIPE_THRESHOLD = 90

/** 卡片类型徽标配色 */
const TYPE_BADGE: Record<CardType, { label: string; classes: string }> = {
  qa: { label: '问答', classes: 'bg-teal-light text-teal' },
  cloze: { label: '填空', classes: 'bg-amber-light text-amber' },
  essay: { label: '论述', classes: 'bg-success-light text-success' },
  compare: { label: '对比', classes: 'bg-coral-light text-coral' },
  recall: { label: '名解', classes: 'bg-blue-light text-blue' },
  choice: { label: '选择', classes: 'bg-coral-light text-coral' },
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

  const [isFlipped, setIsFlipped] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [timer, setTimer] = useState(0)

  // choice / judge 的作答状态（选完才显示评分按钮）
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const swipeState = useRef({ startY: 0, dy: 0, active: false, moved: false })

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
  // 完成态纯派生：队列走完即完成（showComplete 用于返回后清空）
  const isComplete = currentReviewIndex >= reviewQueue.length && reviewQueue.length > 0
  const complete = showComplete || isComplete

  const isAnswerType = currentCard
    ? currentCard.type === 'choice' || currentCard.type === 'judge'
    : false
  const answered = selectedIndex !== null
  // 选择题展示顺序洗牌（按 card.id 确定性）：生成时正确项恒为 options[0]，不能直接渲染
  const shuffled =
    currentCard?.type === 'choice' && currentCard.options
      ? getShuffledOptions(currentCard)
      : null
  // 作答对错：选择题按洗牌后的正确项判断；判断题按所选布尔值
  const answeredCorrectly =
    currentCard && answered
      ? currentCard.type === 'choice'
        ? selectedIndex === shuffled?.correctIndex
        : (selectedIndex === 0) === currentCard.judgeAnswer
      : false
  // 作答型的建议评分：答对 → 记得，答错 → 忘记（空格/回车确认，可改选）
  const suggestedRating = (answeredCorrectly ? 4 : 0) as ReviewRating

  const handleFlip = useCallback(() => {
    // choice/judge 用作答代替翻面
    if (currentCard?.type === 'choice' || currentCard?.type === 'judge') return
    setIsFlipped(f => !f)
  }, [currentCard])

  const handleRate = useCallback(
    (r: ReviewRating) => {
      rateCard(r)
      setTimeout(() => {
        setIsFlipped(false)
        setSelectedIndex(null)
        nextCard()
      }, 300)
    },
    [rateCard, nextCard]
  )

  const handleUndo = useCallback(() => {
    if (!lastReviewSnapshot) return
    undoLastReview()
    setIsFlipped(false)
    setSelectedIndex(null)
  }, [lastReviewSnapshot, undoLastReview])

  // 查看来源块：跳到知识库并高亮该块（复习会话保留，返回后可继续）
  const navigate = useNavigate()
  const goSourceBlock = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      if (!currentCard) return
      navigate(`/?block=${currentCard.blockId}`)
    },
    [currentCard, navigate]
  )

  // ===== 移动端手势评分：翻面后 上滑=简单、下滑=忘记 =====
  const resetCardStyle = () => {
    const el = cardRef.current
    if (el) {
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
    }
  }

  const flyOut = (dir: number) => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
    el.style.transform = `translateY(${dir * 480}px) rotate(${dir * 3}deg)`
    el.style.opacity = '0'
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isFlipped) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 指针捕获不可用时忽略，手势仍可在卡片区域内工作 */
    }
    swipeState.current = { startY: e.clientY, dy: 0, active: true, moved: false }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipeState.current
    if (!s.active) return
    s.dy = e.clientY - s.startY
    if (Math.abs(s.dy) > 6) s.moved = true
    const el = cardRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateY(${s.dy}px)`
      el.style.opacity = String(Math.max(0.5, 1 - Math.abs(s.dy) / 500))
    }
  }

  const handlePointerUp = () => {
    const s = swipeState.current
    if (!s.active) return
    s.active = false
    if (s.dy < -SWIPE_THRESHOLD) {
      flyOut(-1)
      handleRate(5)
    } else if (s.dy > SWIPE_THRESHOLD) {
      flyOut(1)
      handleRate(0)
    } else {
      resetCardStyle()
    }
  }

  const handlePointerCancel = () => {
    swipeState.current.active = false
    resetCardStyle()
  }

  const handleCardClick = () => {
    // 拖拽过就不当作点按，避免评分后误翻转
    if (swipeState.current.moved) {
      swipeState.current.moved = false
      return
    }
    handleFlip()
  }

  // 切换到下一张时清掉上一张的飞出样式
  useEffect(() => {
    resetCardStyle()
  }, [currentReviewIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // 撤销上一张评分
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }
      // 结束确认弹层：Esc 切换
      if (e.key === 'Escape') {
        if (reviewQueue.length > 0 && !showComplete) setShowExitConfirm(v => !v)
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        // 作答型答完：空格按建议评分直接进入下一张
        if (isAnswerType && answered) {
          handleRate(suggestedRating)
        } else {
          handleFlip()
        }
      } else if (isAnswerType && answered && e.key === 'Enter') {
        handleRate(suggestedRating)
      } else if (isFlipped) {
        switch (e.key) {
          case '1': handleRate(0); break
          case '2': handleRate(2); break
          case '3': handleRate(4); break
          case '4': handleRate(5); break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFlipped, handleFlip, handleRate, handleUndo, isAnswerType, answered, suggestedRating, reviewQueue.length, showComplete])

  // Start page
  if (reviewQueue.length === 0 && !showComplete) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 lg:p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-coral-light flex items-center justify-center mx-auto mb-6">
            <BrainCircuit className="w-10 h-10 text-coral" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-[1.75rem] font-medium text-ink tracking-tight mb-2">开始今日复习</h2>

          <div className="grid grid-cols-3 gap-3 my-6">
            <StatCard label="待复习" value={dueCards.length} variant="coral" />
            <StatCard label="新卡片" value={newCards.length} variant="teal" />
            <StatCard label="难卡" value={hardCards.length} variant="amber" />
          </div>

          {cards.length === 0 ? (
            <p className="text-sm text-muted mb-6">
              还没有卡片，先去知识库导入材料并生成卡片吧
            </p>
          ) : dueCards.length + newCards.length === 0 ? (
            <p className="text-sm text-muted mb-6">
              今日复习已完成，太棒了！
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
            开始复习
          </button>
        </div>
      </div>
    )
  }

  // Complete page
  if (complete) {
    const { reviewed, correct } = reviewSession
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 lg:p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" strokeWidth={2} />
          </div>
          <h2 className="font-serif text-[1.75rem] font-medium text-ink tracking-tight mb-2">复习完成！</h2>
          <p className="text-sm text-muted mb-6">坚持就是胜利，每天进步一点点</p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatCard label="已复习" value={reviewed} variant="coral" />
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
      {/* Progress bar */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6">
        <div className="flex items-center justify-between text-xs text-muted mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="w-7 h-7 -ml-1.5 rounded-lg hover:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-ink transition-colors"
              title="结束本次复习 (Esc)"
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
              title="撤销上一张评分 (Ctrl+Z)"
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

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 min-h-0">
        {isAnswerType ? (
          // ===== 作答型：选择 / 判断 —— 点击选项即反馈，无需翻面 =====
          <div key={currentReviewIndex} className="card-enter w-full max-w-2xl bg-surface-card border border-hairline rounded-2xl p-6 lg:p-8" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${TYPE_BADGE[currentCard.type].classes}`}>
                {TYPE_BADGE[currentCard.type].label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={goSourceBlock}
                  className="inline-flex items-center gap-1 text-xs text-muted-soft hover:text-coral transition-colors"
                  title="在知识库中查看并编辑来源块"
                >
                  <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
                  查看来源块
                </button>
                <span className="text-xs text-muted-soft">
                  {currentCard.type === 'choice' ? '点击选项作答' : '判断对错'}
                </span>
              </div>
            </div>
            <p className="text-lg text-ink font-medium leading-relaxed mb-5 whitespace-pre-wrap">
              {currentCard.type === 'judge' && currentCard.front.startsWith('判断：')
                ? currentCard.front.slice(3)
                : currentCard.front}
            </p>

            {currentCard.type === 'choice' && shuffled && (
              <div className="grid gap-2.5">
                {shuffled.options.map((opt, i) => {
                  const isCorrect = i === shuffled.correctIndex
                  const isSelected = i === selectedIndex
                  let cls = 'border-hairline bg-canvas hover:border-coral/50 hover:bg-coral-faint'
                  if (answered) {
                    if (isCorrect) cls = 'border-success/50 bg-success-light text-success'
                    else if (isSelected) cls = 'border-error/50 bg-error-light text-error'
                    else cls = 'border-hairline bg-canvas opacity-50'
                  } else if (isSelected) {
                    cls = 'border-coral bg-coral-faint text-coral'
                  }
                  return (
                    <button
                      key={i}
                      disabled={answered}
                      onClick={() => setSelectedIndex(i)}
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

            {currentCard.type === 'judge' && (
              <div className="grid grid-cols-2 gap-3">
                {([true, false] as const).map(val => {
                  const isCorrect = val === currentCard.judgeAnswer
                  const isSelected = (val === (selectedIndex === 0)) && selectedIndex !== null
                  let cls = 'border-hairline bg-canvas hover:border-coral/50 hover:bg-coral-faint'
                  if (answered) {
                    if (isCorrect) cls = 'border-success/50 bg-success-light text-success'
                    else if (isSelected) cls = 'border-error/50 bg-error-light text-error'
                    else cls = 'border-hairline bg-canvas opacity-50'
                  } else if (isSelected) {
                    cls = 'border-coral bg-coral-faint text-coral'
                  }
                  return (
                    <button
                      key={String(val)}
                      disabled={answered}
                      onClick={() => setSelectedIndex(val ? 0 : 1)}
                      className={`py-4 rounded-xl border text-base font-medium transition-all duration-150 active:scale-[0.98] ${cls}`}
                    >
                      {val ? '✓ 正确' : '✗ 错误'}
                    </button>
                  )
                })}
              </div>
            )}

            {answered && (
              <div className={`mt-5 px-4 py-3 rounded-xl text-sm font-medium ${answeredCorrectly ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
                {answeredCorrectly
                  ? currentCard.type === 'choice'
                    ? `回答正确！${currentCard.back}`
                    : '回答正确！'
                  : `回答错误。${currentCard.back}`}
              </div>
            )}
          </div>
        ) : (
          // ===== 翻面型：问答 / 填空 / 名解 / 论述 / 对比 =====
          <div
            key={currentReviewIndex}
            ref={cardRef}
            className="card-enter card-flip w-full max-w-2xl h-80 cursor-pointer select-none"
            style={{ touchAction: isFlipped ? 'none' : 'manipulation' }}
            onClick={handleCardClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''}`}>
              <div className="card-front bg-canvas border border-hairline" style={{ boxShadow: 'var(--shadow-md)' }}>
                <div className="absolute top-4 left-5">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${TYPE_BADGE[currentCard.type].classes}`}>
                    {TYPE_BADGE[currentCard.type].label}
                  </span>
                </div>
                <p className="text-lg text-ink font-medium leading-relaxed text-center whitespace-pre-wrap px-6">
                  {currentCard.front}
                </p>
                <p className="absolute bottom-4 text-xs text-muted-soft flex items-center gap-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span className="lg:hidden">点按翻转</span>
                  <span className="hidden lg:inline">点击翻转 · 空格键</span>
                </p>
              </div>

              <div className="card-back bg-surface-card border border-hairline" style={{ boxShadow: 'var(--shadow-md)' }}>
                <button
                  onClick={goSourceBlock}
                  className="absolute top-4 right-5 z-10 inline-flex items-center gap-1 text-xs text-muted-soft hover:text-coral transition-colors"
                  title="在知识库中查看并编辑来源块"
                >
                  <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
                  查看来源块
                </button>
                <p
                  className="text-sm text-body leading-relaxed text-left whitespace-pre-wrap overflow-auto max-h-full pb-6 px-6"
                  style={{ touchAction: 'pan-y' }}
                >
                  {currentCard.back}
                </p>
                <div className="absolute bottom-3 inset-x-0 text-center text-xs text-muted-soft lg:hidden">
                  上滑 = 简单 · 下滑 = 忘记
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rating Buttons — 翻面型需翻面后启用；作答型选择后才启用 */}
      <div className="px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-2 lg:gap-3">
          <RatingButton label="忘记" shortcut="1" interval={predictInterval(currentCard, 0)} variant="error" onClick={() => handleRate(0)} disabled={isAnswerType ? !answered : !isFlipped} highlight={isAnswerType && answered && suggestedRating === 0} />
          <RatingButton label="模糊" shortcut="2" interval={predictInterval(currentCard, 2)} variant="amber" onClick={() => handleRate(2)} disabled={isAnswerType ? !answered : !isFlipped} highlight={isAnswerType && answered && suggestedRating === 2} />
          <RatingButton label="记得" shortcut="3" interval={predictInterval(currentCard, 4)} variant="teal" onClick={() => handleRate(4)} disabled={isAnswerType ? !answered : !isFlipped} highlight={isAnswerType && answered && suggestedRating === 4} />
          <RatingButton label="简单" shortcut="4" interval={predictInterval(currentCard, 5)} variant="success" onClick={() => handleRate(5)} disabled={isAnswerType ? !answered : !isFlipped} highlight={isAnswerType && answered && suggestedRating === 5} />
        </div>
      </div>

      {/* 退出确认弹层 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="确认结束复习">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-surface-card border border-hairline rounded-2xl p-6 max-w-sm w-full text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-serif text-lg font-medium text-ink mb-2">结束本次复习？</h3>
            <p className="text-sm text-muted mb-5">已评分的卡片会保留记录，剩余未复习的卡片不会被计入今日进度。</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="py-2.5 rounded-xl border border-coral/40 text-coral text-sm font-medium hover:bg-coral-faint transition-colors"
              >
                继续复习
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false)
                  endReview()
                }}
                className="py-2.5 rounded-xl bg-coral text-on-primary text-sm font-medium hover:bg-coral-active transition-colors"
              >
                结束复习
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

function RatingButton({ label, shortcut, interval, variant, onClick, disabled, highlight = false }: {
  label: string; shortcut: string; interval: number;
  variant: 'error' | 'amber' | 'teal' | 'success'; onClick: () => void; disabled: boolean;
  highlight?: boolean // 作答型答完后的建议评分档（空格/回车直接确认这档）
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
      disabled={disabled}
      className={`py-3 px-4 rounded-xl border text-center transition-all duration-150 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed bg-canvas ${variantStyles[variant]} ${highlight ? 'ring-2 ring-current/40 scale-[1.03]' : ''}`}
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
