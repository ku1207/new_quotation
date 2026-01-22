import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pcBudget, mobileBudget, keywords, optimizationCriterion = 'clicks' } = body

    console.log('=== API 호출 시작 ===')
    console.log('optimizationCriterion:', optimizationCriterion)
    console.log('pcBudget:', pcBudget)
    console.log('mobileBudget:', mobileBudget)
    console.log('keywords 개수:', keywords?.length)

    if (!pcBudget || !mobileBudget || !keywords) {
      console.error('필수 파라미터 누락')
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 클릭 최대화 프롬프트
    const clicksPrompt = `## 역할
너는 '키워드 대량 견적 데이터'를 기반으로 예산 내 클릭을 극대화하는 엑셀 인사이트 보고서 생성 엔진이다.
반드시 입력 JSON에 근거해서만 계산하고, 임의의 추정/창작 수치를 만들지 마라.

## 재현성/일관성 및 라운딩 규칙
1) CTR = clicks / impr (impr=0이면 0). 소수점 4자리 반올림(예: 0.0616).
2) eCPC = cost / clicks (clicks=0이면 0). 정수 유지.
3) 모든 합계(Total)는 개별 행의 합으로 계산하며, 평균(Avg) 지표는 합계 데이터 간의 비율로 재계산한다.
4) 라운딩: bid, cpc, cost, impr, clicks는 정수 유지. 비율 지표는 소수점 4자리 반올림.

## 운영 원칙
1) 키워드 누락 금지: 모든 키워드는 PC와 Mobile 포트폴리오에서 각각 반드시 1개의 Rank가 선택되어야 한다(운영 보장).
2) 동일 성과 하위 순위 원칙: 만약 상위 순위와 하위 순위의 클릭수가 동일하다면, 비용이 더 저렴한 **하위 순위(더 큰 Rank 숫자)**를 최종 선택한다.
3) 0원 순위 반영: 예산이 부족하여 유료 순위 진입이 불가하더라도, 데이터상 비용이 0원인 순위가 있다면 해당 순위를 '선택 Rank'로 기입한다.

## 최적화 알고리즘: Greedy Downgrade (PC/Mobile 개별 수행)
1) 초기 상태: 모든 키워드를 1순위(Rank 1)로 설정한다.
2) 초과 예산 계산: Σ C(selected) > Budget 인 경우 다운그레이드 프로세스 개시.
3) 다운그레이드 후보 생성 (r -> r+1):
(1) ΔC_down = C[r] - C[r+1] (절감 비용)
(2) ΔK_down = K[r] - K[r+1] (잃는 클릭)
(3) LPS (Loss Per Save) = ΔK_down / ΔC_down
4) Tie-break 규칙 (순위 결정 우선순위):
(1) LPS가 낮은 순 (클릭을 적게 잃으면서 돈을 많이 아끼는 순)
(2) ΔK_down이 0인 경우 최우선 적용 (클릭 변화 없이 비용만 절감되는 구간)
(3) ΔC_down이 큰 순
(4) ToRank가 더 큰 숫자(하위 순위)인 순
5) 예산 B 이내가 될 때까지 LPS가 낮은 후보부터 다운그레이드를 반복 적용한다.

## 검증 규칙
1) 모든 시트의 키워드 리스트는 입력 데이터와 100% 일치해야 한다.
2) 소진 비용은 예산을 초과할 수 없다(단, 모든 다운그레이드 후에도 초과 시 최저 비용 조합 반환).
3) 01번 시트의 합계와 02, 03번 시트의 2행(Total) 값은 반드시 일치해야 한다.

## 입력
- PC 예산(B_PC): ${pcBudget}
- Mobile 예산(B_MO): ${mobileBudget}
- 데이터(JSON): ${JSON.stringify(keywords, null, 2)}

## 출력 형태 (JSON Only)
반드시 아래 형식의 JSON 배열만 출력하고, 다른 텍스트는 출력하지 마세요.
[
  {
    "keyword": "키워드명",
    "device": "PC",
    "greedyrank": 1
  },
  {
    "keyword": "키워드명",
    "device": "Mobile",
    "greedyrank": 2
  }
]`

    // 노출 최대화 프롬프트
    const impressionsPrompt = `너는 '키워드 대량 견적 데이터'를 기반으로 예산 내 노출을 극대화하는 엑셀 인사이트 보고서 생성 엔진이다.
반드시 입력 JSON에 근거해서만 계산하고, 임의의 추정/창작 수치를 만들지 마라.

## 재현성/일관성 및 라운딩 규칙
1) CTR = clicks / impr (impr=0이면 0). 소수점 4자리 반올림(예: 0.0616).
2) eCPC = cost / clicks (clicks=0이면 0). 정수 유지.
3) 모든 합계(Total)는 개별 행의 합으로 계산하며, 평균(Avg) 지표는 합계 데이터 간의 비율로 재계산한다.
4) 라운딩: bid, cpc, cost, impr, clicks는 정수 유지. 비율 지표는 소수점 4자리 반올림.

## 운영 원칙
1) 키워드 누락 금지: 모든 키워드는 PC와 Mobile 포트폴리오에서 각각 반드시 1개의 Rank가 선택되어야 한다(운영 보장).
2) 동일 성과 하위 순위 원칙: 만약 상위 순위와 하위 순위의 노출수가 동일하다면, 비용이 더 저렴한 **하위 순위(더 큰 Rank 숫자)**를 최종 선택한다.
3) 0원 순위 반영: 예산이 부족하여 유료 순위 진입이 불가하더라도, 데이터상 비용이 0원인 순위가 있다면 해당 순위를 '선택 Rank'로 기입한다.

## 최적화 알고리즘: Greedy Downgrade (PC/Mobile 개별 수행)
1) 초기 상태: 모든 키워드를 1순위(Rank 1)로 설정한다.
2) 초과 예산 계산: Σ C(selected) > Budget 인 경우 다운그레이드 프로세스 개시.
3) 다운그레이드 후보 생성 (r -> r+1):
(1) ΔC_down = C[r] - C[r+1] (절감 비용)
(2) ΔI_down = I[r] - I[r+1] (잃는 노출)
(3) LPS (Loss Per Save) = ΔI_down / ΔC_down
4) Tie-break 규칙 (순위 결정 우선순위):
(1) LPS가 낮은 순 (노출을 적게 잃으면서 돈을 많이 아끼는 순)
(2) ΔI_down이 0인 경우 최우선 적용 (노출 변화 없이 비용만 절감되는 구간)
(3) ΔC_down이 큰 순
(4) ToRank가 더 큰 숫자(하위 순위)인 순
5) 예산 B 이내가 될 때까지 LPS가 낮은 후보부터 다운그레이드를 반복 적용한다.

## 검증 규칙
1) 모든 시트의 키워드 리스트는 입력 데이터와 100% 일치해야 한다.
2) 소진 비용은 예산을 초과할 수 없다(단, 모든 다운그레이드 후에도 초과 시 최저 비용 조합 반환).
3) 01번 시트의 합계와 02, 03번 시트의 2행(Total) 값은 반드시 일치해야 한다.

## 입력
- PC 예산(B_PC): ${pcBudget}
- Mobile 예산(B_MO): ${mobileBudget}
- 데이터(JSON): ${JSON.stringify(keywords, null, 2)}

## 출력 형태 (JSON Only)
반드시 아래 형식의 JSON 배열만 출력하고, 다른 텍스트는 출력하지 마세요.
[
  {
    "keyword": "키워드명",
    "device": "PC",
    "greedyrank": 1
  },
  {
    "keyword": "키워드명",
    "device": "Mobile",
    "greedyrank": 2
  }
]`

    // optimizationCriterion에 따라 적절한 프롬프트 선택
    let prompt: string
    if (optimizationCriterion === 'impressions' || optimizationCriterion === '노출 최대화') {
      console.log('노출 최대화 프롬프트 사용')
      prompt = impressionsPrompt
    } else {
      console.log('클릭 최대화 프롬프트 사용')
      prompt = clicksPrompt
    }

    console.log('프롬프트 길이:', prompt.length)

    console.log('Claude API 호출 시작...')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    console.log('Claude API 응답 상태:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error status:', response.status)
      console.error('Claude API error:', errorText)
      return NextResponse.json({ error: 'Claude API 호출 실패' }, { status: 500 })
    }

    const data = await response.json()
    console.log('Claude API 응답 받음')
    const content = data.content[0].text
    console.log('응답 내용 길이:', content.length)

    // JSON 파싱
    let optimizationResults: Array<{ keyword: string; device: string; greedyrank: number }>
    try {
      console.log('JSON 파싱 시작...')
      // Claude의 응답에서 JSON 부분만 추출 (마크다운 코드 블록이 있을 수 있음)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        console.log('정규식으로 JSON 추출 성공')
        optimizationResults = JSON.parse(jsonMatch[0])
      } else {
        console.log('직접 JSON 파싱 시도')
        optimizationResults = JSON.parse(content)
      }
      console.log('파싱 성공, 결과 개수:', optimizationResults.length)
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError)
      console.error('Claude 응답:', content)
      return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 500 })
    }

    console.log('=== API 호출 성공 ===')
    return NextResponse.json({ results: optimizationResults })
  } catch (error) {
    console.error('=== AI 최적화 오류 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    if (error instanceof Error) {
      console.error('에러 스택:', error.stack)
    }
    return NextResponse.json({ error: 'AI 최적화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
