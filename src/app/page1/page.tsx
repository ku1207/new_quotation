'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Download, FileSpreadsheet, X } from 'lucide-react'
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

export default function Page1() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [pcRank, setPcRank] = useState<string>('')
  const [mobileRank, setMobileRank] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // 분석 수행
  const handleAnalyze = () => {
    if (!parsedData || !pcRank || !mobileRank) {
      toast.error('모든 정보를 입력해주세요.')
      return
    }

    setIsAnalyzing(true)

    try {
      const pcRankNum = parseInt(pcRank)
      const mobileRankNum = parseInt(mobileRank)

      const analysisKeywords: AnalysisKeywordResult[] = []
      let totalClicks = 0
      let totalCost = 0

      for (const keywordData of parsedData.keywords) {
        const pcData = keywordData.PC.find((d) => d.rank === pcRankNum) || null
        const mobileData = keywordData.Mobile.find((d) => d.rank === mobileRankNum) || null

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
      toast.success('분석이 완료되었습니다.')
    } catch (error) {
      console.error('분석 오류:', error)
      toast.error('분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 분석 결과를 엑셀로 다운로드
  const handleDownloadAnalysis = () => {
    if (!analysisResult) {
      toast.error('분석 결과가 없습니다.')
      return
    }

    try {
      const worksheetData: (string | number)[][] = [
        [
          '키워드',
          'PC 순위',
          'PC 클릭수',
          'PC 광고비용',
          'Mobile 순위',
          'Mobile 클릭수',
          'Mobile 광고비용',
          '총 클릭수',
          '총 광고비용',
          '평균 CPC',
        ],
      ]

      for (const keyword of analysisResult.keywords) {
        worksheetData.push([
          keyword.keyword,
          keyword.pcData ? keyword.pcData.rank : '-',
          keyword.pcData ? keyword.pcData.clicks : 0,
          keyword.pcData ? keyword.pcData.cost : 0,
          keyword.mobileData ? keyword.mobileData.rank : '-',
          keyword.mobileData ? keyword.mobileData.clicks : 0,
          keyword.mobileData ? keyword.mobileData.cost : 0,
          keyword.totalClicks,
          keyword.totalCost,
          Math.round(keyword.avgCPC),
        ])
      }

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '분석 결과')

      XLSX.writeFile(workbook, `분석결과_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('분석 결과가 다운로드되었습니다.')
    } catch (error) {
      console.error('다운로드 오류:', error)
      toast.error('다운로드 중 오류가 발생했습니다.')
    }
  }

  // 분석 버튼 활성화 여부
  const isAnalyzeEnabled = uploadedFile && parsedData && pcRank && mobileRank && !isAnalyzing

  return (
    <div className="min-h-[calc(100vh-65px)] p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">대량견적 결과 파일 분석</h1>
          <p className="text-gray-600">
            엑셀 파일을 업로드하고 분석할 순위를 선택하여 결과를 확인하세요.
          </p>
        </div>

        {/* 부가정보 입력 영역 */}
        <Card>
          <CardHeader>
            <CardTitle>부가정보 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">PC 순위</label>
                <Select value={pcRank} onValueChange={setPcRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="PC 순위 선택" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((rank) => (
                      <SelectItem key={rank} value={rank.toString()}>
                        {rank}순위
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 파일 업로드 영역 */}
        <Card>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button
                onClick={handleAnalyze}
                disabled={!isAnalyzeEnabled}
                className="flex-1"
                size="lg"
              >
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

        {/* 분석 결과 요약 */}
        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle>분석 결과 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">총 키워드 수</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysisResult.summary.totalKeywords.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">총 예상 클릭수</p>
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round(analysisResult.summary.totalClicks).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">총 예상 광고비용</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.round(analysisResult.summary.totalCost).toLocaleString()}원
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">평균 CPC</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {Math.round(analysisResult.summary.avgCPC).toLocaleString()}원
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* JSON 미리보기 영역 */}
        {parsedData && (
          <Card>
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
