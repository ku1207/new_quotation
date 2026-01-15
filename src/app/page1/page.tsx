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

export default function Page1() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisMode, setAnalysisMode] = useState<string>('')
  const [pcRank, setPcRank] = useState<string>('')
  const [mobileRank, setMobileRank] = useState<string>('')
  const [pcBudget, setPcBudget] = useState<string>('')
  const [mobileBudget, setMobileBudget] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 새로운 상태 추가
  const [aggregatedByRank, setAggregatedByRank] = useState<AggregatedRankData | null>(null)
  const [scenarioMatrix, setScenarioMatrix] = useState<ScenarioItem[]>([])
  const [detailKeywordData, setDetailKeywordData] = useState<DetailKeywordRow[]>([])

  // 분석 방식 변경 핸들러 (상태 초기화)
  const handleAnalysisModeChange = (mode: string) => {
    setAnalysisMode(mode)
    // 관련 상태 초기화
    if (mode === '견적 기반') {
      setPcRank('')
      setMobileRank('')
    } else if (mode === '순위 기반') {
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
  const parseExcelFile = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
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

  // 예산 기반으로 최적 순위 찾기
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

  // 분석 수행
  const handleAnalyze = () => {
    if (!parsedData) {
      toast.error('파일을 먼저 업로드해주세요.')
      return
    }

    // 분석 방식별 입력값 검증
    let finalPcRank: number
    let finalMobileRank: number

    if (analysisMode === '견적 기반') {
      const pcBudgetNum = parseInt(pcBudget)
      const mobileBudgetNum = parseInt(mobileBudget)

      if (!pcBudget || !mobileBudget || pcBudgetNum <= 0 || mobileBudgetNum <= 0) {
        toast.error('유효한 예산을 입력해주세요.')
        return
      }

      // 예산 기반으로 최적 순위 찾기
      const optimalPcRank = findOptimalRankByBudget(parsedData.keywords, 'PC', pcBudgetNum)
      const optimalMobileRank = findOptimalRankByBudget(
        parsedData.keywords,
        'Mobile',
        mobileBudgetNum
      )

      if (optimalPcRank === null) {
        toast.error('PC 예산이 부족합니다. 최소 순위의 비용보다 높은 예산을 입력해주세요.')
        return
      }

      if (optimalMobileRank === null) {
        toast.error(
          'Mobile 예산이 부족합니다. 최소 순위의 비용보다 높은 예산을 입력해주세요.'
        )
        return
      }

      finalPcRank = optimalPcRank
      finalMobileRank = optimalMobileRank

      toast.success(`PC ${finalPcRank}순위, Mobile ${finalMobileRank}순위가 선택되었습니다.`)
    } else if (analysisMode === '순위 기반') {
      if (!pcRank || !mobileRank) {
        toast.error('PC 순위와 Mobile 순위를 선택해주세요.')
        return
      }

      finalPcRank = parseInt(pcRank)
      finalMobileRank = parseInt(mobileRank)
    } else {
      toast.error('분석 방식을 선택해주세요.')
      return
    }

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

      // 견적 기반 분석인 경우, 선택된 순위를 상태에 저장
      if (analysisMode === '견적 기반') {
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

  // 분석 결과를 엑셀로 다운로드 (3개 시트)
  const handleDownloadAnalysis = () => {
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
    ((analysisMode === '순위 기반' && pcRank && mobileRank) ||
      (analysisMode === '견적 기반' &&
        pcBudget &&
        mobileBudget &&
        parseInt(pcBudget) > 0 &&
        parseInt(mobileBudget) > 0))

  return (
    <div className="min-h-[calc(100vh-65px)] p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">대량견적 결과 파일 분석</h1>
          <p className="text-gray-600">
            엑셀 파일을 업로드하고 분석 방식을 선택하여 결과를 확인하세요.
          </p>
        </div>

        {/* 분석 방식 선택 영역 */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle>분석 방식 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={analysisMode} onValueChange={handleAnalysisModeChange}>
              <SelectTrigger>
                <SelectValue placeholder="분석 방식을 선택하세요" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="견적 기반">견적 기반</SelectItem>
                <SelectItem value="순위 기반">순위 기반</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 부가정보 입력 영역 - 조건부 렌더링 */}
        {analysisMode && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle>부가정보 입력</CardTitle>
            </CardHeader>
            <CardContent>
              {analysisMode === '견적 기반' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">PC 예산 (원)</label>
                    <Input
                      type="number"
                      step="1"
                      value={pcBudget}
                      onChange={(e) => setPcBudget(e.target.value)}
                      placeholder="PC 예산을 입력하세요"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Mobile 예산 (원)</label>
                    <Input
                      type="number"
                      step="1"
                      value={mobileBudget}
                      onChange={(e) => setMobileBudget(e.target.value)}
                      placeholder="Mobile 예산을 입력하세요"
                      min="0"
                    />
                  </div>
                </div>
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
            </CardContent>
          </Card>
        )}

        {/* 파일 업로드 영역 */}
        <Card className="border-l-4 border-l-green-500">
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
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button
                onClick={handleAnalyze}
                disabled={!isAnalyzeEnabled}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {isAnalyzing ? '분석 중...' : '분석'}
              </Button>
              <Button
                onClick={handleDownloadAnalysis}
                disabled={!analysisResult}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                분석 파일 다운로드
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* JSON 미리보기 영역 */}
        {parsedData && (
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle>JSON 미리보기 (처음 200행)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[500px]">
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      keywords: parsedData.keywords.slice(0, 200),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
