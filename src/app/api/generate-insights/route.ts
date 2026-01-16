import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_api_key_here') {
      return NextResponse.json(
        { error: 'API key not configured. Please set ANTHROPIC_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    const prompt = `당신은 디지털 마케팅 전문가입니다. 키워드 광고 예산 최적화 결과를 분석하여 실무자에게 즉시 활용 가능한 인사이트를 제공해야 합니다.

## 배경
Greedy Downgrade 알고리즘을 통해 주어진 예산 내에서 클릭수를 극대화하는 키워드별 최적 순위를 도출했습니다.
- 초기 상태: 모든 키워드 1위
- 예산 초과 시: LPS(Loss Per Save = 잃는 클릭 ÷ 절감 비용)가 낮은 키워드부터 순위 다운그레이드
- LPS가 낮을수록 "적은 클릭 손실로 큰 비용 절감"이 가능한 효율적 다운그레이드 대상

## 입력 데이터
${JSON.stringify(body, null, 2)}

## 분석 요청사항
아래 5개 영역에 대해 각각 1~2문장으로 핵심 인사이트를 작성하세요.

1. **예산 효율성 평가**: 전체 예산 활용률과 PC/Mobile 간 균형 분석
2. **매체별 전략 방향**: PC와 Mobile의 CPC, CTR 차이를 기반으로 매체 전략 제안
3. **핵심 키워드 분석**: 1위 유지된 키워드들의 공통 특성과 중요도
4. **다운그레이드 패턴**: 순위가 낮아진 키워드들의 패턴과 그 의미
5. **액션 아이템**: 실무자가 즉시 검토해야 할 1~2가지 권고사항

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명 없이 JSON만 출력합니다.

{
  "budget_efficiency": "...",
  "channel_strategy": "...",
  "core_keywords": "...",
  "downgrade_pattern": "...",
  "action_items": "..."
}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 5000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      // JSON 추출
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0])
        return NextResponse.json({ insights })
      }
    }

    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  } catch (error) {
    console.error('Insights generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
