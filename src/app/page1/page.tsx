'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Download, FileSpreadsheet, X, BarChart3 } from 'lucide-react'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'

// 타입 정의
interface KeywordRankData {
  rank: number
  bid: number
  impr: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
}

interface KeywordData {
  keyword: string
  category: string
  PC: KeywordRankData[]
  Mobile: KeywordRankData[]
}

interface ParsedData {
  keywords: KeywordData[]
}

interface AnalysisKeywordResult {
  keyword: string
  pcData: KeywordRankData | null
  mobileData: KeywordRankData | null
  totalClicks: number
  totalCost: number
  avgCPC: number
}

interface AnalysisResult {
  summary: {
    totalKeywords: number
    totalClicks: number
    totalCost: number
    avgCPC: number
  }
  keywords: AnalysisKeywordResult[]
}

// 새로운 타입 정의
interface RankMetrics {
  impr: number
  clicks: number
  cost: number
  ctr: number
  cpc: number
}

interface AggregatedRankData {
  PC: Record<number, RankMetrics>
  Mobile: Record<number, RankMetrics>
}

interface ScenarioItem {
  pcRank: number
  mobileRank: number
  impr: number
  clicks: number
  cost: number
  ctr: number
  cpc: number
}

interface DetailKeywordRow {
  keyword: string
  device: string
  rank: string
  impr: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
}

// 예산 기반 분석 타입
interface DowngradeCandidate {
  keyword: string
  fromRank: number
  toRank: number
  deltaClicks: number
  deltaCost: number
  lps: number
}

interface OptimizationResult {
  keyword: string
  optimalRank: number
  impr: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
}

interface BudgetInsights {
  budget_efficiency: string
  channel_strategy: string
  core_keywords: string
  downgrade_pattern: string
  action_items: string
}

export default function Page1() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisMode, setAnalysisMode] = useState<string>('')
  const [pcRank, setPcRank] = useState<string>('')
  const [mobileRank, setMobileRank] = useState<string>('')
  const [pcBudget, setPcBudget] = useState<string>('')
  const [mobileBudget, setMobileBudget] = useState<string>('')
  const [optimizationGoal, setOptimizationGoal] = useState<'clicks' | 'impressions'>('clicks')
  const [optimizationMethod, setOptimizationMethod] = useState<'logic' | 'ai'>('logic')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // const [isCategorizing, setIsCategorizing] = useState(false) // 카테고리 분류 기능 비활성화로 인해 주석 처리
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 숫자를 한글로 변환하는 함수 (현재 미사용, 향후 사용 가능)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const numberToKorean = (num: number): string => {
    if (num === 0) return '0원'

    const units = ['', '만', '억', '조']
    const smallUnits = ['', '천', '백', '십']

    let result = ''
    let unitIndex = 0

    while (num > 0) {
      const part = num % 10000
      if (part > 0) {
        let partStr = ''
        let tempPart = part
        let smallUnitIndex = 0

        while (tempPart > 0) {
          const digit = tempPart % 10
          if (digit > 0) {
            partStr = (digit === 1 && smallUnitIndex > 0 ? '' : digit.toString()) +
                      smallUnits[smallUnitIndex] + partStr
          }
          tempPart = Math.floor(tempPart / 10)
          smallUnitIndex++
        }

        result = partStr + units[unitIndex] + result
      }
      num = Math.floor(num / 10000)
      unitIndex++
    }

    return result + '원'
  }

  // 숫자를 간결한 한글 금액으로 변환하는 함수
  const formatKoreanCurrency = (num: number): string => {
    if (num === 0) return '0원'

    // 억 단위 (100000000 이상)
    if (num >= 100000000) {
      const eok = Math.floor(num / 100000000)
      if (eok >= 1000) {
        return `${eok.toLocaleString()}억원`
      }
      return `${eok}억원`
    }

    // 만 단위 (10000 이상)
    if (num >= 10000) {
      const man = Math.floor(num / 10000)
      if (man >= 1000) {
        return `${man.toLocaleString()}만원`
      }
      return `${man}만원`
    }

    // 천 단위 (1000 이상)
    if (num >= 1000) {
      const cheon = Math.floor(num / 1000)
      return `${cheon}천원`
    }

    // 천 미만
    return `${num}원`
  }

  // 숫자에 쉼표 추가
  const formatNumberWithComma = (value: string): string => {
    const numbers = value.replace(/[^\d]/g, '')
    if (!numbers) return ''
    return Number(numbers).toLocaleString()
  }

  // 쉼표가 포함된 문자열에서 숫자만 추출
  const removeComma = (value: string): string => {
    return value.replace(/[^\d]/g, '')
  }

  // 새로운 상태 추가
  const [aggregatedByRank, setAggregatedByRank] = useState<AggregatedRankData | null>(null)
  const [scenarioMatrix, setScenarioMatrix] = useState<ScenarioItem[]>([])
  const [detailKeywordData, setDetailKeywordData] = useState<DetailKeywordRow[]>([])

  // 예산 기반 분석 상태
  const [pcOptimizationResult, setPcOptimizationResult] = useState<OptimizationResult[] | null>(
    null
  )
  const [mobileOptimizationResult, setMobileOptimizationResult] = useState<
    OptimizationResult[] | null
  >(null)
  const [budgetInsights, setBudgetInsights] = useState<BudgetInsights | null>(null)

  // 분석 방식 변경 핸들러 (상태 초기화)
  const handleAnalysisModeChange = (mode: string) => {
    setAnalysisMode(mode)
    // 관련 상태 초기화
    if (mode === '예산 기준') {
      setPcRank('')
      setMobileRank('')
    } else if (mode === '순위 기준') {
      setPcBudget('')
      setMobileBudget('')
    }
  }

  // 파일 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    // 파일 형식 검증
    const validExtensions = ['.xlsx', '.xls']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!validExtensions.includes(fileExtension)) {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.')
      return
    }

    setUploadedFile(file)
    setParsedData(null)
    setAnalysisResult(null)
    parseExcelFile(file)
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setParsedData(null)
    setAnalysisResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  // 엑셀 파일 파싱
  const parseExcelFile = async (file: File) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

        if (jsonData.length < 3) {
          toast.error('파일 형식이 올바르지 않습니다. 최소 3행 이상이어야 합니다.')
          return
        }

        const parsed = parseExcelToJSON(jsonData)
        setParsedData(parsed)
        toast.success('파일이 성공적으로 파싱되었습니다.')

        // 카테고리 분류 수행 (현재 비활성화)
        // await categorizeKeywords(parsed)
      } catch (error) {
        console.error('파일 파싱 오류:', error)
        toast.error('파일 파싱 중 오류가 발생했습니다.')
      }
    }

    reader.onerror = () => {
      toast.error('파일 읽기 중 오류가 발생했습니다.')
    }

    reader.readAsBinaryString(file)
  }

  /*
   * 카테고리 자동 분류 기능 (현재 비활성화)
   * 필요 시 주석을 해제하여 다시 활성화할 수 있습니다.
   */
  /*
  const categorizeKeywords = async (parsed: ParsedData) => {
    setIsCategorizing(true)
    toast.info('카테고리 분류 중...')

    try {
      // 키워드 목록 추출
      const keywords = parsed.keywords.map((kw) => kw.keyword)

      // API 호출
      const response = await fetch('/api/categorize-keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords }),
      })

      if (!response.ok) {
        throw new Error('카테고리 분류 API 호출 실패')
      }

      const data = await response.json()
      const categorizedKeywords: Array<{ keyword: string; category: string }> = data.categories

      // 카테고리 매칭
      const categorizedData: ParsedData = {
        keywords: parsed.keywords.map((kw) => {
          const categoryInfo = categorizedKeywords.find((ck) => ck.keyword === kw.keyword)
          return {
            ...kw,
            category: categoryInfo?.category || '미분류',
          }
        }),
      }

      setParsedData(categorizedData)
      toast.success('카테고리 분류가 완료되었습니다.')
    } catch (error) {
      console.error('카테고리 분류 오류:', error)
      toast.warning('카테고리 분류에 실패했습니다. 기본값 "미분류"로 설정됩니다.')

      // 에러 발생 시 기본값 "미분류"로 설정
      const defaultCategorizedData: ParsedData = {
        keywords: parsed.keywords.map((kw) => ({
          ...kw,
          category: '미분류',
        })),
      }

      setParsedData(defaultCategorizedData)
    } finally {
      setIsCategorizing(false)
    }
  }
  */

  // 엑셀 데이터를 JSON으로 변환
  const parseExcelToJSON = (data: unknown[][]): ParsedData => {
    const headerRow = data[0]
    const keywords: KeywordData[] = []

    // 디바이스와 순위 정보 파싱 (첫 번째 행)
    const columnInfo: Array<{ device: string; rank: number; columnIndex: number }> = []
    for (let i = 1; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '')
      const match = header.match(/(PC|Mobile)\s*(\d+)\s*순위/)
      if (match) {
        const device = match[1]
        const rank = parseInt(match[2])
        columnInfo.push({ device, rank, columnIndex: i })
      }
    }

    // 세 번째 행부터 키워드 데이터 파싱
    for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      const keyword = String(row[0] || '').trim()

      if (!keyword) continue

      const keywordData: KeywordData = {
        keyword,
        category: '', // 초기값, 나중에 categorizeKeywords에서 설정됨
        PC: [],
        Mobile: [],
      }

      // 각 디바이스/순위별 데이터 추출
      for (const { device, rank, columnIndex } of columnInfo) {
        const baseIndex = columnIndex
        const bid = Number(row[baseIndex] || 0)
        const impr = Number(row[baseIndex + 1] || 0)
        const clicks = Number(row[baseIndex + 2] || 0)
        const ctr = Number(row[baseIndex + 3] || 0)
        const cpc = Number(row[baseIndex + 4] || 0)
        const cost = Number(row[baseIndex + 5] || 0)

        const rankData: KeywordRankData = {
          rank,
          bid,
          impr,
          clicks,
          ctr,
          cpc,
          cost,
        }

        if (device === 'PC') {
          keywordData.PC.push(rankData)
        } else if (device === 'Mobile') {
          keywordData.Mobile.push(rankData)
        }
      }

      // 순위별로 정렬
      keywordData.PC.sort((a, b) => a.rank - b.rank)
      keywordData.Mobile.sort((a, b) => a.rank - b.rank)

      keywords.push(keywordData)
    }

    return { keywords }
  }

  // 예산 기반으로 최적 순위 찾기 (순위 기반 분석용 - 모든 키워드 동일 순위)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const findOptimalRankByBudget = (
    keywords: KeywordData[],
    device: 'PC' | 'Mobile',
    budget: number
  ): number | null => {
    // 각 순위별 총 비용 계산
    const maxRank = device === 'PC' ? 10 : 5
    const rankCosts: { rank: number; totalCost: number }[] = []

    for (let rank = 1; rank <= maxRank; rank++) {
      let totalCost = 0
      for (const keyword of keywords) {
        const deviceData = device === 'PC' ? keyword.PC : keyword.Mobile
        const rankData = deviceData.find((d) => d.rank === rank)
        if (rankData) {
          totalCost += rankData.cost
        }
      }
      rankCosts.push({ rank, totalCost })
    }

    // 예산 이하면서 비용이 가장 높은 순위 찾기 (높은 순위일수록 비용이 많이 듦)
    // 1순위가 가장 비싸고, 순위가 낮을수록 저렴함
    const validRanks = rankCosts.filter((r) => r.totalCost <= budget)
    if (validRanks.length === 0) return null

    // 가장 높은 비용의 순위 선택 (가장 높은 순위)
    return validRanks.reduce((prev, current) =>
      current.totalCost > prev.totalCost ? current : prev
    ).rank
  }

  // Greedy Downgrade 알고리즘 (예산 기반 분석용 - 키워드별 최적 순위)
  const optimizeBudgetGreedy = (
    keywords: KeywordData[],
    device: 'PC' | 'Mobile',
    budget: number,
    goal: 'clicks' | 'impressions' = 'clicks'
  ): OptimizationResult[] => {
    const maxRank = device === 'PC' ? 10 : 5

    // 1. 모든 키워드를 rank=1로 초기화
    const currentRanks: Record<string, number> = {}
    keywords.forEach((kw) => {
      currentRanks[kw.keyword] = 1
    })

    // 2. 현재 총 비용 계산 함수
    const calculateTotalCost = (): number => {
      let total = 0
      for (const kw of keywords) {
        const rank = currentRanks[kw.keyword]
        const deviceData = device === 'PC' ? kw.PC : kw.Mobile
        const data = deviceData.find((d) => d.rank === rank)
        if (data) total += data.cost
      }
      return total
    }

    // 3. 예산 초과 시 다운그레이드 반복 (최소 감소율 + 최대 감액 목표)
    while (calculateTotalCost() > budget) {
      // 다운그레이드 후보 생성
      const candidates: DowngradeCandidate[] = []

      for (const kw of keywords) {
        const currentRank = currentRanks[kw.keyword]
        if (currentRank >= maxRank) continue // 이미 최하위 순위

        const deviceData = device === 'PC' ? kw.PC : kw.Mobile
        const currentData = deviceData.find((d) => d.rank === currentRank)
        const nextData = deviceData.find((d) => d.rank === currentRank + 1)

        if (!currentData || !nextData) continue

        const deltaCost = currentData.cost - nextData.cost

        if (deltaCost <= 0) continue // 비용이 오히려 증가하는 경우 제외

        let deltaMetric: number
        let lps: number

        if (goal === 'clicks') {
          // 클릭 최대화: 클릭 손실 기준
          deltaMetric = currentData.clicks - nextData.clicks
          lps = deltaCost > 0 ? deltaMetric / deltaCost : Infinity
        } else {
          // 노출 최대화: 노출 손실 기준
          deltaMetric = currentData.impr - nextData.impr
          lps = deltaCost > 0 ? deltaMetric / deltaCost : Infinity
        }

        candidates.push({
          keyword: kw.keyword,
          fromRank: currentRank,
          toRank: currentRank + 1,
          deltaClicks: deltaMetric, // 클릭 또는 노출 손실을 deltaClicks에 저장
          deltaCost,
          lps,
        })
      }

      if (candidates.length === 0) break // 더 이상 다운그레이드 불가능

      // Tie-break 규칙으로 정렬 (최소 감소율 + 최대 감액)
      candidates.sort((a, b) => {
        // 1. 손실이 0인 경우 최우선 (손실 없이 비용만 절감)
        if (a.deltaClicks === 0 && b.deltaClicks !== 0) return -1
        if (a.deltaClicks !== 0 && b.deltaClicks === 0) return 1

        // 2. LPS가 낮은 순 (효율적인 다운그레이드 = 최소 감소율)
        if (Math.abs(a.lps - b.lps) > 0.0001) return a.lps - b.lps

        // 3. ΔC_down이 큰 순 (절감 비용이 큰 순 = 최대 감액)
        if (a.deltaCost !== b.deltaCost) return b.deltaCost - a.deltaCost

        // 4. ToRank가 큰 순 (하위 순위로 많이 내려가는 순)
        return b.toRank - a.toRank
      })

      // 가장 효율적인 후보를 다운그레이드
      const best = candidates[0]
      currentRanks[best.keyword] = best.toRank
    }

    // 3-1. 예산 초과 시 모든 키워드를 최하 순위로 강제 다운그레이드
    let forcedToMaxRank = false
    if (calculateTotalCost() > budget) {
      forcedToMaxRank = true
      for (const kw of keywords) {
        currentRanks[kw.keyword] = maxRank
      }
    }

    // 4. 최종 결과 생성
    const results: OptimizationResult[] = []
    for (const kw of keywords) {
      let optimalRank = currentRanks[kw.keyword]
      const deviceData = device === 'PC' ? kw.PC : kw.Mobile
      const currentData = deviceData.find((d) => d.rank === optimalRank)

      if (currentData) {
        // 최하 순위로 강제 설정된 경우에만 동일 비용 중 가장 높은 순위 찾기
        if (forcedToMaxRank && optimalRank === maxRank) {
          const currentCost = currentData.cost
          for (let rank = 1; rank < optimalRank; rank++) {
            const checkData = deviceData.find((d) => d.rank === rank)
            if (checkData && checkData.cost === currentCost) {
              optimalRank = rank
              break
            }
          }
        }

        const finalData = deviceData.find((d) => d.rank === optimalRank)
        if (finalData) {
          results.push({
            keyword: kw.keyword,
            optimalRank,
            impr: finalData.impr,
            clicks: finalData.clicks,
            ctr: finalData.impr > 0 ? (finalData.clicks / finalData.impr) * 100 : 0,
            cpc: finalData.clicks > 0 ? Math.round(finalData.cost / finalData.clicks) : 0,
            cost: finalData.cost,
          })
        }
      }
    }

    return results
  }

  // Claude API 호출하여 인사이트 생성
  const generateInsights = async (
    pcResults: OptimizationResult[],
    mobileResults: OptimizationResult[],
    pcBudget: number,
    mobileBudget: number
  ): Promise<BudgetInsights | null> => {
    try {
      // PC 총계 계산
      const pcTotal: {
        impr: number
        clicks: number
        cost: number
        ctr?: number
        cpc?: number
      } = {
        impr: pcResults.reduce((sum, r) => sum + r.impr, 0),
        clicks: pcResults.reduce((sum, r) => sum + r.clicks, 0),
        cost: pcResults.reduce((sum, r) => sum + r.cost, 0),
      }
      pcTotal.ctr = pcTotal.impr > 0 ? (pcTotal.clicks / pcTotal.impr) * 100 : 0
      pcTotal.cpc = pcTotal.clicks > 0 ? Math.round(pcTotal.cost / pcTotal.clicks) : 0

      // Mobile 총계 계산
      const mobileTotal: {
        impr: number
        clicks: number
        cost: number
        ctr?: number
        cpc?: number
      } = {
        impr: mobileResults.reduce((sum, r) => sum + r.impr, 0),
        clicks: mobileResults.reduce((sum, r) => sum + r.clicks, 0),
        cost: mobileResults.reduce((sum, r) => sum + r.cost, 0),
      }
      mobileTotal.ctr = mobileTotal.impr > 0 ? (mobileTotal.clicks / mobileTotal.impr) * 100 : 0
      mobileTotal.cpc = mobileTotal.clicks > 0 ? Math.round(mobileTotal.cost / mobileTotal.clicks) : 0

      // 1위 유지된 키워드 찾기
      const pcRank1 = pcResults.filter((r) => r.optimalRank === 1)
      const mobileRank1 = mobileResults.filter((r) => r.optimalRank === 1)

      // API 요청 데이터 구성
      const requestData = {
        pc: {
          budget: pcBudget,
          spent: pcTotal.cost,
          utilization: (pcTotal.cost / pcBudget) * 100,
          total: pcTotal,
          rank1Keywords: pcRank1.length,
          keywords: pcResults,
        },
        mobile: {
          budget: mobileBudget,
          spent: mobileTotal.cost,
          utilization: (mobileTotal.cost / mobileBudget) * 100,
          total: mobileTotal,
          rank1Keywords: mobileRank1.length,
          keywords: mobileResults,
        },
        combined: {
          totalBudget: pcBudget + mobileBudget,
          totalSpent: pcTotal.cost + mobileTotal.cost,
          totalClicks: pcTotal.clicks + mobileTotal.clicks,
          totalImpr: pcTotal.impr + mobileTotal.impr,
        },
      }

      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        console.error('Insights API error:', await response.text())
        return null
      }

      const data = await response.json()
      return data.insights
    } catch (error) {
      console.error('Failed to generate insights:', error)
      return null
    }
  }

  // 분석 수행
  const handleAnalyze = async () => {
    if (!parsedData) {
      toast.error('파일을 먼저 업로드해주세요.')
      return
    }

    if (analysisMode === '예산 기준') {
      // 예산 기반 분석 (Greedy Downgrade)
      await handleBudgetBasedAnalysis()
    } else if (analysisMode === '순위 기준') {
      // 기존 순위 기반 분석
      handleRankBasedAnalysis()
    } else {
      toast.error('분석 방식을 선택해주세요.')
    }
  }

  // 예산 기반 분석 (Greedy Downgrade)
  const handleBudgetBasedAnalysis = async () => {
    if (!parsedData) return

    const pcBudgetNum = parseInt(removeComma(pcBudget))
    const mobileBudgetNum = parseInt(removeComma(mobileBudget))

    if (!pcBudget || !mobileBudget || pcBudgetNum <= 0 || mobileBudgetNum <= 0) {
      toast.error('유효한 예산을 입력해주세요.')
      return
    }

    setIsAnalyzing(true)

    try {
      let pcResults: OptimizationResult[]
      let mobileResults: OptimizationResult[]

      if (optimizationMethod === 'logic') {
        // 로직 기반: Greedy Downgrade 알고리즘 실행 (선택된 최적화 기준 적용)
        pcResults = optimizeBudgetGreedy(parsedData.keywords, 'PC', pcBudgetNum, optimizationGoal)
        mobileResults = optimizeBudgetGreedy(parsedData.keywords, 'Mobile', mobileBudgetNum, optimizationGoal)
      } else {
        // AI 기반: Claude API 호출
        const response = await fetch('/api/optimize-with-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pcBudget: pcBudgetNum,
            mobileBudget: mobileBudgetNum,
            keywords: parsedData.keywords,
          }),
        })

        if (!response.ok) {
          throw new Error('AI 최적화 API 호출 실패')
        }

        const data = await response.json()
        const aiResults: Array<{ keyword: string; device: string; greedyrank: number }> = data.results

        // AI 결과를 OptimizationResult[]로 변환
        pcResults = []
        mobileResults = []

        for (const kw of parsedData.keywords) {
          // PC 결과 찾기
          const pcAI = aiResults.find((r) => r.keyword === kw.keyword && r.device === 'PC')
          if (pcAI) {
            const pcData = kw.PC.find((d) => d.rank === pcAI.greedyrank)
            if (pcData) {
              pcResults.push({
                keyword: kw.keyword,
                optimalRank: pcAI.greedyrank,
                impr: pcData.impr,
                clicks: pcData.clicks,
                ctr: pcData.impr > 0 ? (pcData.clicks / pcData.impr) * 100 : 0,
                cpc: pcData.clicks > 0 ? Math.round(pcData.cost / pcData.clicks) : 0,
                cost: pcData.cost,
              })
            }
          }

          // Mobile 결과 찾기
          const mobileAI = aiResults.find((r) => r.keyword === kw.keyword && r.device === 'Mobile')
          if (mobileAI) {
            const mobileData = kw.Mobile.find((d) => d.rank === mobileAI.greedyrank)
            if (mobileData) {
              mobileResults.push({
                keyword: kw.keyword,
                optimalRank: mobileAI.greedyrank,
                impr: mobileData.impr,
                clicks: mobileData.clicks,
                ctr: mobileData.impr > 0 ? (mobileData.clicks / mobileData.impr) * 100 : 0,
                cpc: mobileData.clicks > 0 ? Math.round(mobileData.cost / mobileData.clicks) : 0,
                cost: mobileData.cost,
              })
            }
          }
        }
      }

      setPcOptimizationResult(pcResults)
      setMobileOptimizationResult(mobileResults)

      // 인사이트 생성 (최적화 방식과 관계없이 항상 실행)
      const insights = await generateInsights(pcResults, mobileResults, pcBudgetNum, mobileBudgetNum)
      if (insights) {
        setBudgetInsights(insights)
        toast.success('예산 기반 분석이 완료되었습니다.')
      } else {
        // AI 인사이트 생성 실패 시 기본 메시지 설정
        setBudgetInsights({
          budget_efficiency: '인사이트 생성에 실패했습니다.',
          channel_strategy: '인사이트 생성에 실패했습니다.',
          core_keywords: '인사이트 생성에 실패했습니다.',
          downgrade_pattern: '인사이트 생성에 실패했습니다.',
          action_items: '인사이트 생성에 실패했습니다.',
        })
        toast.warning('인사이트 생성에 실패했습니다. (분석 결과는 정상적으로 생성되었습니다)')
        toast.success('예산 기반 분석이 완료되었습니다.')
      }
    } catch (error) {
      console.error('예산 기반 분석 오류:', error)
      toast.error('분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 순위 기반 분석 (기존 로직)
  const handleRankBasedAnalysis = () => {
    if (!parsedData) return

    if (!pcRank || !mobileRank) {
      toast.error('PC 순위와 Mobile 순위를 선택해주세요.')
      return
    }

    const finalPcRank = parseInt(pcRank)
    const finalMobileRank = parseInt(mobileRank)

    setIsAnalyzing(true)

    try {
      // 1. 기존 분석 로직 (유지)
      const analysisKeywords: AnalysisKeywordResult[] = []
      let totalClicks = 0
      let totalCost = 0

      for (const keywordData of parsedData.keywords) {
        const pcData = keywordData.PC.find((d) => d.rank === finalPcRank) || null
        const mobileData = keywordData.Mobile.find((d) => d.rank === finalMobileRank) || null

        const keywordClicks = (pcData?.clicks || 0) + (mobileData?.clicks || 0)
        const keywordCost = (pcData?.cost || 0) + (mobileData?.cost || 0)
        const avgCPC = keywordClicks > 0 ? keywordCost / keywordClicks : 0

        analysisKeywords.push({
          keyword: keywordData.keyword,
          pcData,
          mobileData,
          totalClicks: keywordClicks,
          totalCost: keywordCost,
          avgCPC,
        })

        totalClicks += keywordClicks
        totalCost += keywordCost
      }

      const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0

      const result: AnalysisResult = {
        summary: {
          totalKeywords: parsedData.keywords.length,
          totalClicks,
          totalCost,
          avgCPC,
        },
        keywords: analysisKeywords,
      }

      setAnalysisResult(result)

      // 예산 기준 분석인 경우, 선택된 순위를 상태에 저장
      if (analysisMode === '예산 기준') {
        setPcRank(finalPcRank.toString())
        setMobileRank(finalMobileRank.toString())
      }

      // 2. rank별 디바이스별 데이터 합산
      const aggregated: AggregatedRankData = {
        PC: {},
        Mobile: {},
      }

      // PC 1-10위 초기화
      for (let rank = 1; rank <= 10; rank++) {
        aggregated.PC[rank] = { impr: 0, clicks: 0, cost: 0, ctr: 0, cpc: 0 }
      }

      // Mobile 1-5위 초기화
      for (let rank = 1; rank <= 5; rank++) {
        aggregated.Mobile[rank] = { impr: 0, clicks: 0, cost: 0, ctr: 0, cpc: 0 }
      }

      // 각 키워드 데이터를 순회하면서 합산
      for (const keywordData of parsedData.keywords) {
        // PC 데이터 합산
        for (const pcData of keywordData.PC) {
          if (pcData.rank >= 1 && pcData.rank <= 10) {
            aggregated.PC[pcData.rank].impr += pcData.impr
            aggregated.PC[pcData.rank].clicks += pcData.clicks
            aggregated.PC[pcData.rank].cost += pcData.cost
          }
        }

        // Mobile 데이터 합산
        for (const mobileData of keywordData.Mobile) {
          if (mobileData.rank >= 1 && mobileData.rank <= 5) {
            aggregated.Mobile[mobileData.rank].impr += mobileData.impr
            aggregated.Mobile[mobileData.rank].clicks += mobileData.clicks
            aggregated.Mobile[mobileData.rank].cost += mobileData.cost
          }
        }
      }

      // CTR과 CPC 계산
      for (let rank = 1; rank <= 10; rank++) {
        const pcMetrics = aggregated.PC[rank]
        pcMetrics.ctr = pcMetrics.impr > 0 ? (pcMetrics.clicks / pcMetrics.impr) * 100 : 0
        pcMetrics.cpc = pcMetrics.clicks > 0 ? Math.round(pcMetrics.cost / pcMetrics.clicks) : 0
      }

      for (let rank = 1; rank <= 5; rank++) {
        const mobileMetrics = aggregated.Mobile[rank]
        mobileMetrics.ctr =
          mobileMetrics.impr > 0 ? (mobileMetrics.clicks / mobileMetrics.impr) * 100 : 0
        mobileMetrics.cpc =
          mobileMetrics.clicks > 0 ? Math.round(mobileMetrics.cost / mobileMetrics.clicks) : 0
      }

      setAggregatedByRank(aggregated)

      // 3. 50가지 조합 생성 (PC 1-10 x Mobile 1-5)
      const scenarios: ScenarioItem[] = []

      for (let pcRank = 1; pcRank <= 10; pcRank++) {
        for (let mobileRank = 1; mobileRank <= 5; mobileRank++) {
          const pcMetrics = aggregated.PC[pcRank]
          const mobileMetrics = aggregated.Mobile[mobileRank]

          const combinedImpr = pcMetrics.impr + mobileMetrics.impr
          const combinedClicks = pcMetrics.clicks + mobileMetrics.clicks
          const combinedCost = pcMetrics.cost + mobileMetrics.cost

          const combinedCtr = combinedImpr > 0 ? (combinedClicks / combinedImpr) * 100 : 0
          const combinedCpc = combinedClicks > 0 ? Math.round(combinedCost / combinedClicks) : 0

          scenarios.push({
            pcRank,
            mobileRank,
            impr: combinedImpr,
            clicks: combinedClicks,
            cost: combinedCost,
            ctr: combinedCtr,
            cpc: combinedCpc,
          })
        }
      }

      setScenarioMatrix(scenarios)

      // 4. 상세 키워드 데이터 생성
      const detailRows: DetailKeywordRow[] = []

      for (const keywordData of parsedData.keywords) {
        // PC 데이터 추가
        const pcData = keywordData.PC.find((d) => d.rank === finalPcRank)
        if (pcData) {
          detailRows.push({
            keyword: keywordData.keyword,
            device: 'PC',
            rank: finalPcRank.toString(),
            impr: pcData.impr,
            clicks: pcData.clicks,
            ctr: pcData.impr > 0 ? (pcData.clicks / pcData.impr) * 100 : 0,
            cpc: pcData.clicks > 0 ? Math.round(pcData.cost / pcData.clicks) : 0,
            cost: pcData.cost,
          })
        }

        // Mobile 데이터 추가
        const mobileData = keywordData.Mobile.find((d) => d.rank === finalMobileRank)
        if (mobileData) {
          detailRows.push({
            keyword: keywordData.keyword,
            device: 'Mobile',
            rank: finalMobileRank.toString(),
            impr: mobileData.impr,
            clicks: mobileData.clicks,
            ctr: mobileData.impr > 0 ? (mobileData.clicks / mobileData.impr) * 100 : 0,
            cpc: mobileData.clicks > 0 ? Math.round(mobileData.cost / mobileData.clicks) : 0,
            cost: mobileData.cost,
          })
        }
      }

      // 광고비(cost) 내림차순 정렬
      detailRows.sort((a, b) => b.cost - a.cost)

      setDetailKeywordData(detailRows)

      toast.success('분석이 완료되었습니다.')
    } catch (error) {
      console.error('분석 오류:', error)
      toast.error('분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 다운로드 분기 처리
  const handleDownloadAnalysis = () => {
    if (analysisMode === '예산 기준') {
      handleDownloadBudgetAnalysis()
    } else if (analysisMode === '순위 기준') {
      handleDownloadRankAnalysis()
    } else {
      toast.error('분석 방식을 먼저 선택해주세요.')
    }
  }

  // 예산 기반 분석 결과를 엑셀로 다운로드 (4개 시트)
  const handleDownloadBudgetAnalysis = async () => {
    if (!pcOptimizationResult || !mobileOptimizationResult || !parsedData || !uploadedFile) {
      toast.error('분석 결과가 없습니다.')
      return
    }

    try {
      const pcBudgetNum = parseInt(removeComma(pcBudget))
      const mobileBudgetNum = parseInt(removeComma(mobileBudget))

      // PC 총계 계산
      const pcTotal = {
        impr: pcOptimizationResult.reduce((sum, r) => sum + r.impr, 0),
        clicks: pcOptimizationResult.reduce((sum, r) => sum + r.clicks, 0),
        cost: pcOptimizationResult.reduce((sum, r) => sum + r.cost, 0),
      }
      const pcCtr = pcTotal.impr > 0 ? (pcTotal.clicks / pcTotal.impr) * 100 : 0
      const pcCpc = pcTotal.clicks > 0 ? Math.round(pcTotal.cost / pcTotal.clicks) : 0

      // Mobile 총계 계산
      const mobileTotal = {
        impr: mobileOptimizationResult.reduce((sum, r) => sum + r.impr, 0),
        clicks: mobileOptimizationResult.reduce((sum, r) => sum + r.clicks, 0),
        cost: mobileOptimizationResult.reduce((sum, r) => sum + r.cost, 0),
      }
      const mobileCtr = mobileTotal.impr > 0 ? (mobileTotal.clicks / mobileTotal.impr) * 100 : 0
      const mobileCpc = mobileTotal.clicks > 0 ? Math.round(mobileTotal.cost / mobileTotal.clicks) : 0

      const workbook = XLSX.utils.book_new()

      // ========== 시트 1: 01_Insight_Summary ==========
      const sheet1Data: (string | number)[][] = []

      // KPI 요약 테이블
      sheet1Data.push(['KPI 요약'])
      sheet1Data.push(['구분', '설정 예산', '소진 비용', '활용률(%)', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])
      sheet1Data.push([
        'PC',
        pcBudgetNum,
        pcTotal.cost,
        pcTotal.cost / pcBudgetNum, // 활용률: 소진 비용 / 설정 예산 (퍼센트 포맷이 자동으로 *100)
        pcTotal.impr,
        pcTotal.clicks,
        pcCtr / 100,
        pcCpc,
        pcTotal.cost,
      ])
      sheet1Data.push([
        'Mobile',
        mobileBudgetNum,
        mobileTotal.cost,
        mobileTotal.cost / mobileBudgetNum, // 활용률: 소진 비용 / 설정 예산
        mobileTotal.impr,
        mobileTotal.clicks,
        mobileCtr / 100,
        mobileCpc,
        mobileTotal.cost,
      ])
      sheet1Data.push([
        '합계',
        pcBudgetNum + mobileBudgetNum,
        pcTotal.cost + mobileTotal.cost,
        (pcTotal.cost + mobileTotal.cost) / (pcBudgetNum + mobileBudgetNum), // 활용률: 소진 비용 / 설정 예산
        pcTotal.impr + mobileTotal.impr,
        pcTotal.clicks + mobileTotal.clicks,
        pcTotal.impr + mobileTotal.impr > 0
          ? (pcTotal.clicks + mobileTotal.clicks) / (pcTotal.impr + mobileTotal.impr)
          : 0,
        pcTotal.clicks + mobileTotal.clicks > 0
          ? Math.round((pcTotal.cost + mobileTotal.cost) / (pcTotal.clicks + mobileTotal.clicks))
          : 0,
        pcTotal.cost + mobileTotal.cost,
      ])

      // 2행 띄우기
      sheet1Data.push([])
      sheet1Data.push([])

      // 인사이트 영역
      if (budgetInsights) {
        sheet1Data.push(['인사이트'])
        sheet1Data.push([])
        sheet1Data.push(['예산 효율성 평가'])
        sheet1Data.push([budgetInsights.budget_efficiency])
        sheet1Data.push([])
        sheet1Data.push(['매체별 전략 방향'])
        sheet1Data.push([budgetInsights.channel_strategy])
        sheet1Data.push([])
        sheet1Data.push(['핵심 키워드 분석'])
        sheet1Data.push([budgetInsights.core_keywords])
        sheet1Data.push([])
        sheet1Data.push(['최적화 전략'])
        sheet1Data.push([budgetInsights.downgrade_pattern])
        sheet1Data.push([])
        sheet1Data.push(['운영 전략 제안'])
        sheet1Data.push([budgetInsights.action_items])
      } else {
        sheet1Data.push(['인사이트'])
        sheet1Data.push(['인사이트 생성에 실패했습니다.'])
      }

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
      ws1['!gridlines'] = false
      ws1['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ]

      // 숫자 포맷 적용
      for (let i = 2; i <= 4; i++) {
        // KPI 테이블 데이터 행
        // CTR (컬럼 F, 인덱스 6)
        const ctrCell = XLSX.utils.encode_cell({ r: i, c: 6 })
        if (ws1[ctrCell]) ws1[ctrCell].z = '0.00%'

        // 활용률 (컬럼 D, 인덱스 3)
        const utilizationCell = XLSX.utils.encode_cell({ r: i, c: 3 })
        if (ws1[utilizationCell]) ws1[utilizationCell].z = '0.00%'

        // 숫자 포맷 (예산, 비용, 노출수, 클릭수, CPC, 광고비)
        for (const col of [1, 2, 4, 5, 7, 8]) {
          const cell = XLSX.utils.encode_cell({ r: i, c: col })
          if (ws1[cell]) ws1[cell].z = '#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws1, '01_Insight_Summary')

      // ========== 시트 2: 02_Budget_Optimizer_PC ==========
      const sheet2Data: (string | number)[][] = []
      sheet2Data.push(['PC 예산 최적화 결과'])
      sheet2Data.push(['키워드', '최적 순위', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])

      // 합계 행
      sheet2Data.push(['합계', '-', pcTotal.impr, pcTotal.clicks, pcCtr / 100, pcCpc, pcTotal.cost])

      // 키워드별 데이터 (광고비 내림차순 정렬)
      const sortedPcResults = [...pcOptimizationResult].sort((a, b) => b.cost - a.cost)
      for (const row of sortedPcResults) {
        sheet2Data.push([
          row.keyword,
          row.optimalRank,
          row.impr,
          row.clicks,
          row.ctr / 100,
          row.cpc,
          row.cost,
        ])
      }

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data)
      ws2['!gridlines'] = false
      ws2['!cols'] = [
        { wch: 25 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ]

      // 숫자 포맷
      for (let i = 2; i < sheet2Data.length; i++) {
        // CTR
        const ctrCell = XLSX.utils.encode_cell({ r: i, c: 4 })
        if (ws2[ctrCell]) ws2[ctrCell].z = '0.00%'

        // 숫자 포맷
        for (const col of [2, 3, 5, 6]) {
          const cell = XLSX.utils.encode_cell({ r: i, c: col })
          if (ws2[cell]) ws2[cell].z = '#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws2, '02_Budget_Optimizer_PC')

      // ========== 시트 3: 03_Budget_Optimizer_Mobile ==========
      const sheet3Data: (string | number)[][] = []
      sheet3Data.push(['Mobile 예산 최적화 결과'])
      sheet3Data.push(['키워드', '최적 순위', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])

      // 합계 행
      sheet3Data.push(['합계', '-', mobileTotal.impr, mobileTotal.clicks, mobileCtr / 100, mobileCpc, mobileTotal.cost])

      // 키워드별 데이터 (광고비 내림차순 정렬)
      const sortedMobileResults = [...mobileOptimizationResult].sort((a, b) => b.cost - a.cost)
      for (const row of sortedMobileResults) {
        sheet3Data.push([
          row.keyword,
          row.optimalRank,
          row.impr,
          row.clicks,
          row.ctr / 100,
          row.cpc,
          row.cost,
        ])
      }

      const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data)
      ws3['!gridlines'] = false
      ws3['!cols'] = [
        { wch: 25 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ]

      // 숫자 포맷
      for (let i = 2; i < sheet3Data.length; i++) {
        // CTR
        const ctrCell = XLSX.utils.encode_cell({ r: i, c: 4 })
        if (ws3[ctrCell]) ws3[ctrCell].z = '0.00%'

        // 숫자 포맷
        for (const col of [2, 3, 5, 6]) {
          const cell = XLSX.utils.encode_cell({ r: i, c: col })
          if (ws3[cell]) ws3[cell].z = '#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws3, '03_Budget_Optimizer_Mobile')

      // ========== 시트 4: 04_Raw_Wide ==========
      // 원본 파일을 읽어서 그대로 추가
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const originalWorkbook = XLSX.read(data, { type: 'binary' })
          const originalSheetName = originalWorkbook.SheetNames[0]
          const originalSheet = originalWorkbook.Sheets[originalSheetName]

          // 그리드라인 제거
          originalSheet['!gridlines'] = false

          XLSX.utils.book_append_sheet(workbook, originalSheet, '04_Raw_Wide')

          // 파일 다운로드
          const fileName = `예산기반_분석결과_${new Date().toISOString().split('T')[0]}.xlsx`
          XLSX.writeFile(workbook, fileName)
          toast.success('분석 결과가 다운로드되었습니다.')
        } catch (error) {
          console.error('원본 파일 읽기 오류:', error)
          toast.error('원본 파일을 읽는 중 오류가 발생했습니다.')
        }
      }

      reader.onerror = () => {
        toast.error('원본 파일을 읽는 중 오류가 발생했습니다.')
      }

      reader.readAsBinaryString(uploadedFile)
    } catch (error) {
      console.error('다운로드 오류:', error)
      toast.error('다운로드 중 오류가 발생했습니다.')
    }
  }

  // 순위 기반 분석 결과를 엑셀로 다운로드 (3개 시트)
  const handleDownloadRankAnalysis = () => {
    if (!analysisResult || !aggregatedByRank || scenarioMatrix.length === 0) {
      toast.error('분석 결과가 없습니다.')
      return
    }

    try {
      const pcRankNum = parseInt(pcRank)
      const mobileRankNum = parseInt(mobileRank)

      // 사용자가 선택한 조합 찾기
      const selectedScenario = scenarioMatrix.find(
        (s) => s.pcRank === pcRankNum && s.mobileRank === mobileRankNum
      )

      if (!selectedScenario) {
        toast.error('선택한 조합을 찾을 수 없습니다.')
        return
      }

      // 최대/최소 조합 찾기
      const maxImprScenario = scenarioMatrix.reduce((prev, current) =>
        current.impr > prev.impr ? current : prev
      )
      const maxClicksScenario = scenarioMatrix.reduce((prev, current) =>
        current.clicks > prev.clicks ? current : prev
      )
      const maxCtrScenario = scenarioMatrix.reduce((prev, current) =>
        current.ctr > prev.ctr ? current : prev
      )
      const minCpcScenario = scenarioMatrix.reduce((prev, current) =>
        current.cpc < prev.cpc ? current : prev
      )
      const minCostScenario = scenarioMatrix.reduce((prev, current) =>
        current.cost < prev.cost ? current : prev
      )

      const workbook = XLSX.utils.book_new()

      // ========== 시트 1: 01_Insight_Summary ==========
      const sheet1Data: (string | number)[][] = []

      // 테이블 1: 목표 순위 지표
      sheet1Data.push(['목표 순위 지표'])
      sheet1Data.push(['PC Rank', 'Mobile Rank', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])
      sheet1Data.push([
        pcRankNum,
        mobileRankNum,
        selectedScenario.impr,
        selectedScenario.clicks,
        selectedScenario.ctr / 100, // 퍼센트를 소수로 변환
        selectedScenario.cpc,
        selectedScenario.cost,
      ])

      // 2행 띄우기
      sheet1Data.push([])
      sheet1Data.push([])

      // 테이블 2: 분석
      sheet1Data.push(['분석'])
      sheet1Data.push(['PC Rank', 'Mobile Rank', '노출수', '클릭수', 'CTR', 'CPC', '광고비', '비고'])
      sheet1Data.push([
        selectedScenario.pcRank,
        selectedScenario.mobileRank,
        selectedScenario.impr,
        selectedScenario.clicks,
        selectedScenario.ctr / 100,
        selectedScenario.cpc,
        selectedScenario.cost,
        '목표 순위',
      ])
      sheet1Data.push([
        maxImprScenario.pcRank,
        maxImprScenario.mobileRank,
        maxImprScenario.impr,
        maxImprScenario.clicks,
        maxImprScenario.ctr / 100,
        maxImprScenario.cpc,
        maxImprScenario.cost,
        '최대 노출수',
      ])
      sheet1Data.push([
        maxClicksScenario.pcRank,
        maxClicksScenario.mobileRank,
        maxClicksScenario.impr,
        maxClicksScenario.clicks,
        maxClicksScenario.ctr / 100,
        maxClicksScenario.cpc,
        maxClicksScenario.cost,
        '최대 클릭수',
      ])
      sheet1Data.push([
        maxCtrScenario.pcRank,
        maxCtrScenario.mobileRank,
        maxCtrScenario.impr,
        maxCtrScenario.clicks,
        maxCtrScenario.ctr / 100,
        maxCtrScenario.cpc,
        maxCtrScenario.cost,
        '최대 CTR',
      ])
      sheet1Data.push([
        minCpcScenario.pcRank,
        minCpcScenario.mobileRank,
        minCpcScenario.impr,
        minCpcScenario.clicks,
        minCpcScenario.ctr / 100,
        minCpcScenario.cpc,
        minCpcScenario.cost,
        '최소 CPC',
      ])
      sheet1Data.push([
        minCostScenario.pcRank,
        minCostScenario.mobileRank,
        minCostScenario.impr,
        minCostScenario.clicks,
        minCostScenario.ctr / 100,
        minCostScenario.cpc,
        minCostScenario.cost,
        '최소 광고비',
      ])

      // 2행 띄우기
      sheet1Data.push([])
      sheet1Data.push([])

      // 테이블 3: 인사이트
      const pcOnlyMetrics = aggregatedByRank.PC[pcRankNum]
      const mobileOnlyMetrics = aggregatedByRank.Mobile[mobileRankNum]

      sheet1Data.push(['인사이트'])
      sheet1Data.push(['디바이스 효율 비교'])
      sheet1Data.push([
        `PC만 (${pcRankNum}순위): 노출수 ${Math.round(
          pcOnlyMetrics.impr
        ).toLocaleString()}, 클릭수 ${Math.round(
          pcOnlyMetrics.clicks
        ).toLocaleString()}, CTR ${pcOnlyMetrics.ctr.toFixed(2)}%, CPC ${Math.round(
          pcOnlyMetrics.cpc
        ).toLocaleString()}원, 광고비 ${Math.round(pcOnlyMetrics.cost).toLocaleString()}원`,
      ])
      sheet1Data.push([
        `Mobile만 (${mobileRankNum}순위): 노출수 ${Math.round(
          mobileOnlyMetrics.impr
        ).toLocaleString()}, 클릭수 ${Math.round(
          mobileOnlyMetrics.clicks
        ).toLocaleString()}, CTR ${mobileOnlyMetrics.ctr.toFixed(2)}%, CPC ${Math.round(
          mobileOnlyMetrics.cpc
        ).toLocaleString()}원, 광고비 ${Math.round(mobileOnlyMetrics.cost).toLocaleString()}원`,
      ])
      sheet1Data.push([
        `PC+Mobile 조합: 노출수 ${Math.round(
          selectedScenario.impr
        ).toLocaleString()}, 클릭수 ${Math.round(
          selectedScenario.clicks
        ).toLocaleString()}, CTR ${selectedScenario.ctr.toFixed(2)}%, CPC ${Math.round(
          selectedScenario.cpc
        ).toLocaleString()}원, 광고비 ${Math.round(selectedScenario.cost).toLocaleString()}원`,
      ])

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
      ws1['!gridlines'] = false
      ws1['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
      ]

      // 셀 병합 (인사이트 섹션)
      ws1['!merges'] = [
        // 인사이트 제목 (A-G 병합)
        { s: { r: sheet1Data.length - 5, c: 0 }, e: { r: sheet1Data.length - 5, c: 6 } },
        // 디바이스 효율 비교 헤더 (A-G 병합)
        { s: { r: sheet1Data.length - 4, c: 0 }, e: { r: sheet1Data.length - 4, c: 6 } },
        // PC만 (A-G 병합)
        { s: { r: sheet1Data.length - 3, c: 0 }, e: { r: sheet1Data.length - 3, c: 6 } },
        // Mobile만 (A-G 병합)
        { s: { r: sheet1Data.length - 2, c: 0 }, e: { r: sheet1Data.length - 2, c: 6 } },
        // PC+Mobile (A-G 병합)
        { s: { r: sheet1Data.length - 1, c: 0 }, e: { r: sheet1Data.length - 1, c: 6 } },
      ]

      // CTR 퍼센트 포맷 적용
      for (let i = 2; i < sheet1Data.length; i++) {
        if (sheet1Data[i][4] !== undefined && typeof sheet1Data[i][4] === 'number') {
          const cellAddress = XLSX.utils.encode_cell({ r: i, c: 4 })
          if (ws1[cellAddress]) {
            ws1[cellAddress].z = '0.00%'
          }
        }
      }

      // 숫자 포맷 적용 (노출수, 클릭수, CPC, 광고비)
      for (let i = 2; i < sheet1Data.length; i++) {
        for (const col of [2, 3, 5, 6]) {
          if (sheet1Data[i][col] !== undefined && typeof sheet1Data[i][col] === 'number') {
            const cellAddress = XLSX.utils.encode_cell({ r: i, c: col })
            if (ws1[cellAddress]) {
              ws1[cellAddress].z = '#,##0'
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws1, '01_Insight_Summary')

      // ========== 시트 2: 02_Scenario_Matrix ==========
      const sheet2Data: (string | number)[][] = []
      sheet2Data.push(['조합표'])
      sheet2Data.push(['PC Rank', 'Mobile Rank', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])

      for (const scenario of scenarioMatrix) {
        sheet2Data.push([
          scenario.pcRank,
          scenario.mobileRank,
          scenario.impr,
          scenario.clicks,
          scenario.ctr / 100,
          scenario.cpc,
          scenario.cost,
        ])
      }

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data)
      ws2['!gridlines'] = false
      ws2['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ]

      // CTR 퍼센트 포맷
      for (let i = 2; i < sheet2Data.length; i++) {
        const cellAddress = XLSX.utils.encode_cell({ r: i, c: 4 })
        if (ws2[cellAddress]) {
          ws2[cellAddress].z = '0.00%'
        }
      }

      // 숫자 포맷 (노출수, 클릭수, CPC, 광고비)
      for (let i = 2; i < sheet2Data.length; i++) {
        for (const col of [2, 3, 5, 6]) {
          const cellAddress = XLSX.utils.encode_cell({ r: i, c: col })
          if (ws2[cellAddress]) {
            ws2[cellAddress].z = '#,##0'
          }
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws2, '02_Scenario_Matrix')

      // ========== 시트 3: 03_Target_Detail ==========
      const sheet3Data: (string | number)[][] = []
      sheet3Data.push(['상세 키워드 데이터'])
      sheet3Data.push(['키워드', '디바이스', '지정 순위', '노출수', '클릭수', 'CTR', 'CPC', '광고비'])

      // 총합 행 계산
      let totalImpr = 0
      let totalClicks = 0
      let totalCost = 0

      for (const row of detailKeywordData) {
        totalImpr += row.impr
        totalClicks += row.clicks
        totalCost += row.cost
      }

      const totalCtr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0
      const totalCpc = totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0

      // 총합 행 추가
      sheet3Data.push(['총합', '-', '-', totalImpr, totalClicks, totalCtr / 100, totalCpc, totalCost])

      // 상세 데이터 추가
      for (const row of detailKeywordData) {
        sheet3Data.push([
          row.keyword,
          row.device,
          row.rank,
          row.impr,
          row.clicks,
          row.ctr / 100,
          row.cpc,
          row.cost,
        ])
      }

      const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data)
      ws3['!gridlines'] = false
      ws3['!cols'] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ]

      // CTR 퍼센트 포맷
      for (let i = 2; i < sheet3Data.length; i++) {
        const cellAddress = XLSX.utils.encode_cell({ r: i, c: 5 })
        if (ws3[cellAddress]) {
          ws3[cellAddress].z = '0.00%'
        }
      }

      // 숫자 포맷 (노출수, 클릭수, CPC, 광고비)
      for (let i = 2; i < sheet3Data.length; i++) {
        for (const col of [3, 4, 6, 7]) {
          const cellAddress = XLSX.utils.encode_cell({ r: i, c: col })
          if (ws3[cellAddress]) {
            ws3[cellAddress].z = '#,##0'
          }
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws3, '03_Target_Detail')

      // 파일 다운로드
      const fileName = `분석결과_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success('분석 결과가 다운로드되었습니다.')
    } catch (error) {
      console.error('다운로드 오류:', error)
      toast.error('다운로드 중 오류가 발생했습니다.')
    }
  }

  // 분석 버튼 활성화 여부
  const isAnalyzeEnabled =
    uploadedFile &&
    parsedData &&
    !isAnalyzing &&
    ((analysisMode === '순위 기준' && pcRank && mobileRank) ||
      (analysisMode === '예산 기준' &&
        pcBudget &&
        mobileBudget &&
        parseInt(removeComma(pcBudget)) > 0 &&
        parseInt(removeComma(mobileBudget)) > 0))

  // 다운로드 버튼 활성화 여부
  const isDownloadEnabled =
    (analysisMode === '순위 기준' && analysisResult !== null) ||
    (analysisMode === '예산 기준' &&
      pcOptimizationResult !== null &&
      mobileOptimizationResult !== null &&
      budgetInsights !== null)

  // 배경색 동적 설정
  const cardBgColor = analysisMode === '순위 기준' ? 'bg-blue-50/50' :
                      analysisMode === '예산 기준' ? 'bg-indigo-50/50' : 'bg-gray-50/50'

  return (
    <div className="min-h-[calc(100vh-65px)] p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI 맞춤형 견적</h1>
          <p className="text-gray-600">
            엑셀 파일을 업로드하고 분석 방식을 선택하여 결과를 확인하세요.
          </p>
        </div>

        {/* 견적 기준 선택 및 부가정보 입력 영역 */}
        <Card className={cardBgColor}>
          <CardHeader>
            <CardTitle>견적 기준 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => handleAnalysisModeChange('순위 기준')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  analysisMode === '순위 기준'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                목표 순위
              </button>
              <button
                onClick={() => handleAnalysisModeChange('예산 기준')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  analysisMode === '예산 기준'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                예산 기준
              </button>
            </div>

            {/* 부가정보 입력 - 조건부 렌더링 */}
            {analysisMode && (
              <div className="space-y-4">
                {analysisMode === '예산 기준' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">PC 예산 (원)</label>
                        <Input
                          type="text"
                          value={pcBudget}
                          onChange={(e) => {
                            const formatted = formatNumberWithComma(e.target.value)
                            setPcBudget(formatted)
                          }}
                          placeholder="PC 예산을 입력하세요"
                        />
                        {pcBudget && (
                          <p className="text-sm text-gray-600 mt-1">
                            {formatKoreanCurrency(parseInt(removeComma(pcBudget)))}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Mobile 예산 (원)</label>
                        <Input
                          type="text"
                          value={mobileBudget}
                          onChange={(e) => {
                            const formatted = formatNumberWithComma(e.target.value)
                            setMobileBudget(formatted)
                          }}
                          placeholder="Mobile 예산을 입력하세요"
                        />
                        {mobileBudget && (
                          <p className="text-sm text-gray-600 mt-1">
                            {formatKoreanCurrency(parseInt(removeComma(mobileBudget)))}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 최적화 기준 선택 버튼 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">최적화 기준</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOptimizationGoal('clicks')}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                            optimizationGoal === 'clicks'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                          }`}
                        >
                          클릭 최대화
                        </button>
                        <button
                          onClick={() => setOptimizationGoal('impressions')}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                            optimizationGoal === 'impressions'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                          }`}
                        >
                          노출 최대화
                        </button>
                      </div>
                    </div>

                    {/* 최적화 방식 선택 버튼 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">최적화 방식</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOptimizationMethod('logic')}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                            optimizationMethod === 'logic'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                          }`}
                        >
                          로직 기반
                        </button>
                        <button
                          onClick={() => setOptimizationMethod('ai')}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                            optimizationMethod === 'ai'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                          }`}
                        >
                          AI 기반
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">PC 순위</label>
                      <Select value={pcRank} onValueChange={setPcRank}>
                        <SelectTrigger>
                          <SelectValue placeholder="PC 순위 선택" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => (
                            <SelectItem key={rank} value={rank.toString()}>
                              {rank}순위
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Mobile 순위</label>
                      <Select value={mobileRank} onValueChange={setMobileRank}>
                        <SelectTrigger>
                          <SelectValue placeholder="Mobile 순위 선택" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {[1, 2, 3, 4, 5].map((rank) => (
                            <SelectItem key={rank} value={rank.toString()}>
                              {rank}순위
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 파일 업로드 영역 */}
        <Card className="bg-green-50/50">
          <CardHeader>
            <CardTitle>파일 업로드</CardTitle>
          </CardHeader>
          <CardContent>
            {!uploadedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileClick}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">
                  드래그 앤 드롭 또는 클릭하여 파일 선택
                </p>
                <p className="text-sm text-gray-500">엑셀 파일(.xlsx, .xls)만 허용됩니다</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 버튼 영역 */}
        <Card className="bg-purple-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button
                onClick={handleAnalyze}
                disabled={!isAnalyzeEnabled}
                className={`flex-1 text-white ${
                  !isAnalyzeEnabled
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                size="lg"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {isAnalyzing ? '분석 중...' : '분석'}
              </Button>
              <Button
                onClick={handleDownloadAnalysis}
                disabled={!isDownloadEnabled}
                className={`flex-1 text-white ${
                  !isDownloadEnabled
                    ? 'bg-green-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                분석 파일 다운로드
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
