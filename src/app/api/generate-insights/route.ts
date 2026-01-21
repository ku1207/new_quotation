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

    const prompt = `## 역할
당신은 데이터 기반의 시니어 퍼포먼스 마케팅 전략가입니다. 단순한 숫자 나열을 넘어, 광고 입찰 데이터 속에 숨겨진 '한계 효용'과 '전략적 기회비용'을 분석하여 광고주의 수익을 극대화하는 실행안을 도출합니다.

## 목표
제공된 는 Greedy Downgrade 알고리즘으로 최적화된 결과입니다. 당신은 이 데이터를 바탕으로 '최소 비용으로 최대 클릭'을 얻기 위한 최적의 포트폴리오 전략 보고서를 JSON 형식으로 생성해야 합니다.

## 입력 데이터
${JSON.stringify(body, null, 2)}

## 분석 가이드라인 (필수 반영)
1. Capital Efficiency (자본 효율성): 단순히 예산 소진율을 보는 것이 아니라, 예산이 특정 매체에 쏠려 '수익 체감의 법칙(Diminishing Returns)'이 발생하는 지점이 어디인지 분석하세요.
2. Device-Specific Funnel (기기별 퍼널 전략): PC와 Mobile의 CTR/CPC 격차를 단순 현상이 아닌, '사용자의 탐색 의도' 차이로 해석하여 매체별 예산 배분 우선순위를 결정하세요.
3. Strategic Moat (전략적 해자): 1위를 유지한 키워드들을 '방어적 핵심 자산'으로 규정하고, 이들이 전체 성과에서 차지하는 기여도와 유지 실익을 평가하세요.
4. Efficiency Sacrifice (효율적 희생): 순위가 하락한 키워드군을 '저효율 구간 이탈'로 해석하고, 해당 키워드에서 절감된 비용이 어떤 고효율 키워드로 전이되었는지 파악하세요.
5. Actionable Priority (실행 우선순위): "모니터링" 같은 모호한 단어 대신 "A 매체 예산 n%를 B로 전용", "C 키워드 입찰가 가중치 조정" 등 구체적 액션을 제안하세요.

## 제약 사항
- 알고리즘(LPS 등), 분석 가이드라인에 대한 기술적 설명은 배제하고, 오직 '비즈니스 인사이트'와 '실행 전략'에만 집중하세요.
- 모든 답변은 데이터에 기반한 수치적 근거를 포함해야 하며, 1~2문장의 간결하고 임팩트 있는 문체로 작성하세요.
- 결과물은 반드시 아래 지정된 JSON 형식만 출력하며, 외부 텍스트는 일절 금지합니다.

## 출력 형태 (JSON Only)
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

    console.log('Claude API Response:', JSON.stringify(message, null, 2))

    const content = message.content[0]
    if (content.type === 'text') {
      console.log('Response text:', content.text)

      // JSON 추출 - 더 robust하게 처리
      try {
        // 1. 중괄호로 감싸진 JSON 찾기
        const jsonMatch = content.text.match(/\{[\s\S]*\}/g)
        if (jsonMatch && jsonMatch.length > 0) {
          // 가장 큰 JSON 객체 선택 (전체 응답일 가능성이 높음)
          const largestJson = jsonMatch.reduce((a, b) => (a.length > b.length ? a : b))
          const insights = JSON.parse(largestJson)

          // 필수 필드 검증
          if (
            insights.budget_efficiency &&
            insights.channel_strategy &&
            insights.core_keywords &&
            insights.downgrade_pattern &&
            insights.action_items
          ) {
            console.log('Successfully parsed insights:', insights)
            return NextResponse.json({ insights })
          } else {
            console.error('Missing required fields in insights:', insights)
          }
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError)
        console.error('Failed to parse text:', content.text)
      }
    }

    console.error('Failed to extract insights from response')
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        details: content.type === 'text' ? content.text : 'No text content'
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Insights generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
