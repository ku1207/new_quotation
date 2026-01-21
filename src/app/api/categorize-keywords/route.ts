/*
 * 이 API 엔드포인트는 현재 비활성화되어 있습니다.
 * 키워드 카테고리 자동 분류 기능을 일시적으로 중단했습니다.
 * 필요 시 주석을 해제하여 다시 활성화할 수 있습니다.
 */

/*
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json()

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: '유효한 키워드 배열을 제공해주세요.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const prompt = `당신은 디지털 마케팅(검색광고) 전략가이자 데이터 기반 분류 전문가입니다. 주어진 '키워드 목록'을 분석해, 캠페인 운영에 바로 쓸 수 있는 키워드 카테고리 체계를 만들고 각 키워드를 반드시 1개 카테고리로만 매칭하세요.

## 배경
- 본 작업의 목적은 키워드들을 의미/의도/상품·서비스 맥락에 따라 묶어, 구조화된 운영(입찰/예산/소재/랜딩/확장)을 가능하게 하는 것입니다.
- 정해진 카테고리는 없으며, 입력 키워드의 패턴을 바탕으로 스스로 카테고리를 설계해야 합니다.
- 각 키워드는 정확히 1개 카테고리에만 속해야 합니다(중복 분류 금지). 반대로, 하나의 카테고리에 여러 키워드가 속할 수 있습니다.

## 입력 데이터
${JSON.stringify(keywords)}

## 분류 원칙(출력에는 규칙/알고리즘 설명 금지)
아래 기준을 내부적으로 활용하여 분류하되, 결과에는 "왜 이런 규칙을 썼는지"를 설명하지 마세요.
- 검색 의도 기반으로 우선 묶기: 정보 탐색형 / 비교·검토형 / 구매·전환형 / 브랜드·네비게이션형 / 문제해결형 등
- 수식어 패턴 반영: 가격(저렴/할인/견적), 지역(서울/강남/near me), 시간(오늘/주말/24시), 대상(초보/학생/기업), 행동(예약/구매/상담/문의)
- 상품/서비스 단위 분리: 서로 다른 제품군/서비스군이면 가급적 다른 카테고리로
- 브랜드/경쟁사/자사 신호가 있으면 별도 분리(가능한 경우)
- 카테고리 이름은 실무자가 바로 이해할 수 있게 짧고 명확하게(예: "가격·할인", "지역 기반", "예약·상담 전환형", "브랜드/네비게이션", "비교·추천" 등)

※ 데이터 구조가 다르더라도, 제공된 필드(keyword)에서 키워드 문자열을 추출해 분류하세요.
※ 카테고리는 "너무 잘게" 쪼개지 말고, 운영에 도움이 되는 수준으로 적절히 묶으세요(권장: 5~15개 내외, 단 키워드 수에 따라 자동 조정).
※ 카테고리 간 경계가 애매한 키워드는 가장 강한 의도/가장 결정적인 수식어 기준으로 한 곳에만 배정하세요.
※ 가능한 경우, 카테고리별로 대표 키워드(상위 1~3개)를 내부적으로 선정해 일관성 있게 분류하세요(출력에는 대표 키워드를 포함해도 되지만, 설명은 최소화).

## 출력 형식(반드시 JSON만 출력, 다른 텍스트 금지)
[
  { "keyword": "키워드1", "category": "카테고리명" },
  { "keyword": "키워드2", "category": "카테고리명" }
]

## 검증 조건(출력에는 쓰지 말고 내부적으로만 체크)
- 모든 입력 키워드는 결과 배열에 정확히 1회 등장(누락/중복 금지)
- 하나의 키워드는 하나의 category만 가짐(다중 카테고리 금지)
- category는 입력 키워드 패턴으로부터 자연스럽게 도출된 명확한 라벨이어야 함`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      return NextResponse.json({ error: 'Claude API 호출 실패' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.content[0].text

    // JSON 파싱
    let categorizedKeywords: Array<{ keyword: string; category: string }>
    try {
      // Claude의 응답에서 JSON 부분만 추출 (마크다운 코드 블록이 있을 수 있음)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        categorizedKeywords = JSON.parse(jsonMatch[0])
      } else {
        categorizedKeywords = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError)
      console.error('Claude 응답:', content)
      return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 500 })
    }

    return NextResponse.json({ categories: categorizedKeywords })
  } catch (error) {
    console.error('카테고리 분류 오류:', error)
    return NextResponse.json({ error: '카테고리 분류 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
*/

// 임시로 빈 엔드포인트를 export하여 빌드 오류 방지
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: '이 기능은 현재 비활성화되어 있습니다.' }, { status: 503 })
}
