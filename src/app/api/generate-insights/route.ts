import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 입력 데이터 로깅
    console.log('='.repeat(80))
    console.log('📊 API 요청 데이터 (Insights 생성)')
    console.log('='.repeat(80))
    console.log(JSON.stringify(body, null, 2))
    console.log('='.repeat(80))

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
  당신은 데이터 기반의 시니어 퍼포먼스 마케팅 전략가입니다. 광고 입찰 데이터 속에 숨겨진 전체 포트폴리오의 구조적 효율성과 전략적 방향성을 제안하는 데 집중합니다.

  ## 목표
  제공된 데이터는 Greedy Downgrade 알고리즘으로 최적화된 결과입니다. 당신은 이 데이터를 바탕으로 '최소 비용으로 최대 클릭'을 위한 거시적 전략 보고서를 JSON 형식으로 생성하세요.

## 입력 데이터
${JSON.stringify(body, null, 2)}

## 분석 가이드라인 (필수 반영)
1. Capital Efficiency (자본 효율성): 예산 쏠림 및 '수익 체감의 법칙(Diminishing Returns)' 발생 지점 분석.
2. Device-Specific Funnel (기기별 퍼널 전략): PC/Mobile 채널별 '사용자 탐색 의도' 해석 및 매체별 예산 배분 우선순위 결정.
3. Strategic Moat (전략적 해자): 1위 유지 키워드의 '방어 실익' 및 기여도 평가.
4. Efficiency Sacrifice (효율적 희생): 순위 하락 키워드군을 '저효율 구간 이탈'로 해석하고, 절감 및 고효율 키워드로의 전이 파악.
5. Actionable Priority (실행 우선순위): "A 매체 예산 n%를 B로 전용", "C 키워드 입찰가 가중치 조정" 등 즉시 실행 가능한 액션 제안.

## 제약 사항
- 키워드 언급 지양: 특정 키워드명을 직접 언급하는 것은 반드시 필요한 경우(전체 비중의 30% 이상 차지 등)를 제외하고는 지양.
- 간결성 극대화: 모든 문장은 개조식으로 작성하며, 불필요한 수식어를 배제하고 단어/명사형(예: ~제한, ~필요, ~확인됨)으로 마무리.
- 인사이트 중심: 단순 숫자 나열보다는 해당 숫자가 갖는 비즈니스 의미를 우선 기술하세요.
- 구조: 단일 문장들로 구성된 배열 형태로 작성.
- 결과물은 반드시 아래 지정된 JSON 형식만 출력하며, 외부 텍스트는 일절 금지.

## 출력 형태 (JSON Only)
{
  "budget_efficiency": ["..."],
  "channel_strategy": ["..."],
  "action_items": ["..."]
}`

    // Prompt 내용 로깅
    console.log('\n' + '='.repeat(80))
    console.log('🤖 Claude API에 전송될 Prompt')
    console.log('='.repeat(80))
    console.log(prompt)
    console.log('='.repeat(80) + '\n')

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
