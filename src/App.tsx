import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Empresa = {
  id: number
  nome: string
  cnpj?: string
  enderecoCompleto?: string
  telefone?: string
  email?: string
  logo?: string
}

type Funcao = {
  id: number
  descricao: string
  codigo: string
}

type Usuario = {
  id: number
  nome: string
  login: string
  email: string
  empresa_id?: number
  funcoes?: Funcao[]
}

type Paginated<T> = {
  count: number
  rows: T[]
}

type LoginPayload = {
  login: string
  senha: string
}

type CompanyForm = {
  nome: string
  cnpj: string
  enderecoCompleto: string
  telefone: string
  email: string
  logo: string
}

type UserForm = {
  nome: string
  login: string
  email: string
  senha: string
  empresa_id: string
  funcoes: number[]
}

type IntegrationStatusBreakdown = {
  status: string
  count: number
  percentage: number
}

type IntegrationStats = {
  period: string
  totalIntegrations: number
  successRate: number
  statusBreakdown: IntegrationStatusBreakdown[]
}

type IntegrationFailure = {
  id: number
  date: string
  cpf: string | null
  error: string
  status?: string
  path?: string
}

type IntegrationFailuresAnalysis = {
  totalFailures: number
  uniqueCpfCount: number
  failurePatterns: Record<string, number>
  recentFailures: IntegrationFailure[]
}

type IntegracaoRow = {
  id: number
  data_registro?: string
  data_envio?: string
  status?: string
  critica_retorno?: string | null
  path?: string
  usuario_id?: number
}

type IntegrationListData = {
  count: number
  rows: IntegracaoRow[]
  page: number
  size: number
  filters: {
    critica: string
    status: string
    onlyErrors: boolean
  }
}

type EventLogForm = {
  data_hora: string
  tipo_documento: string
  UUID: string
  cpf_user: string
  tipo_evento: string
  chave: string
}

type FormErrors<T extends string> = Partial<Record<T, string>>

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'techlist.admin.token'

const emptyCompany: CompanyForm = {
  nome: '',
  cnpj: '',
  enderecoCompleto: '',
  telefone: '',
  email: '',
  logo: '',
}

const emptyUser: UserForm = {
  nome: '',
  login: '',
  email: '',
  senha: '',
  empresa_id: '',
  funcoes: [],
}

const emptyEventLog: EventLogForm = {
  data_hora: new Date().toISOString().slice(0, 16),
  tipo_documento: 'cadastro_completo',
  UUID: '',
  cpf_user: '',
  tipo_evento: 'ENVIO_APP',
  chave: 'motorista.cpf',
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function validateCompany(form: CompanyForm): FormErrors<keyof CompanyForm> {
  const errors: FormErrors<keyof CompanyForm> = {}

  if (!form.nome.trim()) {
    errors.nome = 'Nome da empresa e obrigatorio.'
  } else if (form.nome.trim().length < 3) {
    errors.nome = 'Nome deve ter ao menos 3 caracteres.'
  }

  const cnpjDigits = sanitizeDigits(form.cnpj)
  if (cnpjDigits && cnpjDigits.length !== 14) {
    errors.cnpj = 'CNPJ deve ter 14 digitos.'
  }

  if (form.email && !isValidEmail(form.email)) {
    errors.email = 'Email invalido.'
  }

  return errors
}

function validateUser(form: UserForm): FormErrors<keyof UserForm> {
  const errors: FormErrors<keyof UserForm> = {}

  if (!form.nome.trim()) errors.nome = 'Nome e obrigatorio.'
  if (!form.login.trim()) errors.login = 'Login e obrigatorio.'
  if (!form.email.trim()) {
    errors.email = 'Email e obrigatorio.'
  } else if (!isValidEmail(form.email)) {
    errors.email = 'Email invalido.'
  }
  if (!form.senha || form.senha.length < 6) {
    errors.senha = 'Senha deve ter no minimo 6 caracteres.'
  }
  if (form.funcoes.length === 0) {
    errors.funcoes = 'Selecione ao menos uma funcao.'
  }

  return errors
}

function validateEventLog(form: EventLogForm): FormErrors<keyof EventLogForm> {
  const errors: FormErrors<keyof EventLogForm> = {}

  if (!form.data_hora.trim()) errors.data_hora = 'Data e hora são obrigatórias.'
  if (!form.tipo_documento.trim()) errors.tipo_documento = 'Tipo do documento é obrigatório.'
  if (!form.UUID.trim()) errors.UUID = 'UUID é obrigatório.'
  if (!form.cpf_user.trim()) errors.cpf_user = 'CPF do usuário é obrigatório.'
  if (!form.tipo_evento.trim()) errors.tipo_evento = 'Tipo do evento é obrigatório.'
  if (!form.chave.trim()) errors.chave = 'Chave é obrigatória.'

  return errors
}

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [loginForm, setLoginForm] = useState<LoginPayload>({ login: '', senha: '' })
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'users' | 'integrations'>('overview')
  const [globalError, setGlobalError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)

  const [health, setHealth] = useState<Record<string, unknown> | null>(null)

  const [companies, setCompanies] = useState<Empresa[]>([])
  const [companyCount, setCompanyCount] = useState(0)
  const [companyPage, setCompanyPage] = useState(0)
  const companySize = 20
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompany)
  const [companyErrors, setCompanyErrors] = useState<FormErrors<keyof CompanyForm>>({})
  const [isSavingCompany, setIsSavingCompany] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null)
  const [loadingCompanyActionId, setLoadingCompanyActionId] = useState<number | null>(null)
  const [companySearch, setCompanySearch] = useState('')

  const [users, setUsers] = useState<Usuario[]>([])
  const [userCount, setUserCount] = useState(0)
  const [userPage, setUserPage] = useState(0)
  const userSize = 20
  const [userForm, setUserForm] = useState<UserForm>(emptyUser)
  const [userErrors, setUserErrors] = useState<FormErrors<keyof UserForm>>({})
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [loadingUserActionId, setLoadingUserActionId] = useState<number | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const [allCompanies, setAllCompanies] = useState<Empresa[]>([])
  const [allRoles, setAllRoles] = useState<Funcao[]>([])

  const [integrationStats, setIntegrationStats] = useState<IntegrationStats | null>(null)
  const [integrationFailures, setIntegrationFailures] = useState<IntegrationFailuresAnalysis | null>(null)
  const [integrationRows, setIntegrationRows] = useState<IntegracaoRow[]>([])
  const [integrationCount, setIntegrationCount] = useState(0)
  const [integrationPage, setIntegrationPage] = useState(0)
  const integrationSize = 20
  const [integrationCriticaFilter, setIntegrationCriticaFilter] = useState('')
  const [integrationOnlyErrors, setIntegrationOnlyErrors] = useState(true)
  const [isLoadingIntegrationRows, setIsLoadingIntegrationRows] = useState(false)
  const [eventLogForm, setEventLogForm] = useState<EventLogForm>(emptyEventLog)
  const [eventLogErrors, setEventLogErrors] = useState<FormErrors<keyof EventLogForm>>({})
  const [isSavingEventLog, setIsSavingEventLog] = useState(false)
  const [retryIntegrationId, setRetryIntegrationId] = useState('')
  const [isRetryingIntegration, setIsRetryingIntegration] = useState(false)

  const toastMessage = globalError || successMessage
  const toastType = globalError ? 'error' : 'success'
  const isBusy =
    isAuthenticating ||
    isLoadingData ||
    isSavingCompany ||
    isSavingUser ||
    isSavingEventLog ||
    isRetryingIntegration ||
    isLoadingIntegrationRows

  const totalCompanyPages = useMemo(
    () => Math.max(1, Math.ceil(companyCount / companySize)),
    [companyCount],
  )
  const totalUserPages = useMemo(() => Math.max(1, Math.ceil(userCount / userSize)), [userCount])
  const totalIntegrationPages = useMemo(
    () => Math.max(1, Math.ceil(integrationCount / integrationSize)),
    [integrationCount],
  )

  const filteredCompanies = useMemo(() => {
    const query = normalizeText(companySearch.trim())
    if (!query) return companies

    return companies.filter((company) => {
      const haystack = normalizeText(
        [company.nome, company.cnpj ?? '', company.email ?? '', company.telefone ?? ''].join(' '),
      )
      return haystack.includes(query)
    })
  }, [companySearch, companies])

  const filteredUsers = useMemo(() => {
    const query = normalizeText(userSearch.trim())
    if (!query) return users

    return users.filter((user) => {
      const roleNames = (user.funcoes ?? []).map((role) => role.descricao).join(' ')
      const haystack = normalizeText(
        [user.nome, user.login, user.email, String(user.empresa_id ?? ''), roleNames].join(' '),
      )
      return haystack.includes(query)
    })
  }, [userSearch, users])

  const integrationStatusCards = useMemo(
    () => integrationStats?.statusBreakdown ?? [],
    [integrationStats],
  )

  const apiRequest = useCallback(async function <T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      requiresAuth?: boolean
    },
  ): Promise<T> {
    const method = options?.method ?? 'GET'
    const requiresAuth = options?.requiresAuth ?? false
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (requiresAuth && token) {
      headers.Authorization = `Bearer ${token}`
      headers['x-access-token'] = token
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json') ? await response.json() : await response.text()

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : `Falha na requisicao (${response.status})`
      throw new Error(message)
    }

    return payload as T
  }, [token])

  const loadCompanies = useCallback(async (page: number) => {
    const data = await apiRequest<Paginated<Empresa>>(`/api/companies?page=${page}&size=${companySize}`, {
      requiresAuth: true,
    })
    setCompanies(data.rows ?? [])
    setCompanyCount(data.count ?? 0)
  }, [apiRequest])

  const loadUsers = useCallback(async (page: number) => {
    const data = await apiRequest<Paginated<Usuario>>(`/usuario?page=${page}&size=${userSize}`, {
      requiresAuth: true,
    })
    setUsers(data.rows ?? [])
    setUserCount(data.count ?? 0)
  }, [apiRequest])

  const loadReferenceData = useCallback(async () => {
    const [companiesData, roleData] = await Promise.all([
      apiRequest<Empresa[]>('/api/companies/listAll', { requiresAuth: true }),
      apiRequest<Funcao[]>('/funcao/listAll', { requiresAuth: true }),
    ])
    setAllCompanies(companiesData)
    setAllRoles(roleData)
  }, [apiRequest])

  const loadIntegrationMonitoring = useCallback(async () => {
    try {
      const [statsData, failuresData] = await Promise.all([
        apiRequest<{ success: boolean; data: IntegrationStats }>(
          '/api/v1/monitoring/integration-stats?days=7',
          { requiresAuth: true },
        ),
        apiRequest<{ success: boolean; data: IntegrationFailuresAnalysis }>(
          '/api/v1/monitoring/motorista-failures?limit=8',
          { requiresAuth: true },
        ),
      ])

      setIntegrationStats(statsData.data)
      setIntegrationFailures(failuresData.data)
    } catch (error) {
      setIntegrationStats(null)
      setIntegrationFailures(null)
      setGlobalError(error instanceof Error ? error.message : 'Falha ao carregar monitoramento de integrações.')
    }
  }, [apiRequest])

  const loadIntegrationsList = useCallback(
    async (page: number, critica: string, onlyErrors: boolean) => {
      setIsLoadingIntegrationRows(true)

      try {
        const params = new URLSearchParams({
          page: String(page),
          size: String(integrationSize),
          critica,
          onlyErrors: String(onlyErrors),
        })

        const response = await apiRequest<{ success: boolean; data: IntegrationListData }>(
          `/api/v1/monitoring/integrations?${params.toString()}`,
          { requiresAuth: true },
        )

        setIntegrationRows(response.data.rows ?? [])
        setIntegrationCount(response.data.count ?? 0)
      } catch (error) {
        setIntegrationRows([])
        setIntegrationCount(0)
        setGlobalError(error instanceof Error ? error.message : 'Falha ao carregar lista de integrações.')
      } finally {
        setIsLoadingIntegrationRows(false)
      }
    },
    [apiRequest],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const runHealthCheck = async () => {
        try {
          const data = await apiRequest<Record<string, unknown>>('/health')
          setHealth(data)
        } catch (error) {
          setHealth({
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Nao foi possivel consultar health.',
          })
        }
      }

      void runHealthCheck()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [apiRequest])

  useEffect(() => {
    if (!successMessage) return undefined

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage('')
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)

      const timeoutId = window.setTimeout(() => {
        const loadInitialPrivateData = async () => {
          setIsLoadingData(true)
          setGlobalError('')

          try {
            await Promise.all([
              loadCompanies(0),
              loadUsers(0),
              loadReferenceData(),
              loadIntegrationMonitoring(),
              loadIntegrationsList(0, integrationCriticaFilter, integrationOnlyErrors),
            ])
            setCompanyPage(0)
            setUserPage(0)
            setIntegrationPage(0)
          } catch (error) {
            setGlobalError(
              error instanceof Error ? error.message : 'Falha ao carregar dados administrativos.',
            )
          } finally {
            setIsLoadingData(false)
          }
        }

        void loadInitialPrivateData()
      }, 0)

      return () => window.clearTimeout(timeoutId)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }

    return undefined
  }, [
    integrationCriticaFilter,
    integrationOnlyErrors,
    loadCompanies,
    loadIntegrationMonitoring,
    loadIntegrationsList,
    loadReferenceData,
    loadUsers,
    token,
  ])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')

    if (!loginForm.login.trim() || !loginForm.senha.trim()) {
      setAuthError('Informe login e senha para continuar.')
      return
    }

    setIsAuthenticating(true)
    try {
      const response = await apiRequest<{ accessToken: string }>('/auth/signin', {
        method: 'POST',
        body: loginForm,
      })

      if (!response.accessToken) {
        throw new Error('A API nao retornou accessToken.')
      }

      setToken(response.accessToken)
      setLoginForm({ login: '', senha: '' })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha na autenticacao.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  function logout() {
    setToken('')
    setAuthError('')
    setGlobalError('')
    setSuccessMessage('')
    setActiveTab('overview')
    setCompanies([])
    setUsers([])
    setAllCompanies([])
    setAllRoles([])
    setEditingCompanyId(null)
    setEditingUserId(null)
    setCompanySearch('')
    setUserSearch('')
    setIntegrationStats(null)
    setIntegrationFailures(null)
    setIntegrationRows([])
    setIntegrationCount(0)
    setIntegrationPage(0)
    setIntegrationCriticaFilter('')
    setIntegrationOnlyErrors(true)
    setEventLogForm(emptyEventLog)
    setEventLogErrors({})
    setRetryIntegrationId('')
  }

  function resetCompanyForm() {
    setCompanyForm(emptyCompany)
    setCompanyErrors({})
    setEditingCompanyId(null)
  }

  function resetUserForm() {
    setUserForm(emptyUser)
    setUserErrors({})
    setEditingUserId(null)
  }

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateCompany(companyForm)
    setCompanyErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setIsSavingCompany(true)
    setGlobalError('')

    try {
      await apiRequest('/api/companies', {
        method: editingCompanyId ? 'PUT' : 'POST',
        requiresAuth: true,
        body: {
          ...(editingCompanyId ? { id: editingCompanyId } : {}),
          ...companyForm,
          nome: companyForm.nome.trim(),
          cnpj: sanitizeDigits(companyForm.cnpj),
          email: companyForm.email.trim(),
        },
      })
      resetCompanyForm()
      setSuccessMessage(editingCompanyId ? 'Empresa atualizada com sucesso.' : 'Empresa criada com sucesso.')
      await loadCompanies(companyPage)
      await loadReferenceData()
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao salvar empresa.')
    } finally {
      setIsSavingCompany(false)
    }
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateUser(userForm)
    setUserErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setIsSavingUser(true)
    setGlobalError('')

    try {
      await apiRequest('/usuario', {
        method: editingUserId ? 'PUT' : 'POST',
        requiresAuth: true,
        body: {
          ...(editingUserId ? { id: editingUserId, senhaAntiga: '' } : {}),
          nome: userForm.nome.trim(),
          login: userForm.login.trim(),
          email: userForm.email.trim(),
          ...(userForm.senha ? { senha: userForm.senha } : {}),
          empresa_id: userForm.empresa_id ? Number(userForm.empresa_id) : undefined,
          funcoes: userForm.funcoes,
        },
      })
      resetUserForm()
      setSuccessMessage(editingUserId ? 'Usuario atualizado com sucesso.' : 'Usuario criado com sucesso.')
      await loadUsers(userPage)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao salvar usuario.')
    } finally {
      setIsSavingUser(false)
    }
  }

  async function startEditCompany(companyId: number) {
    setLoadingCompanyActionId(companyId)
    setGlobalError('')
    try {
      const company = await apiRequest<Empresa>(`/api/companies/${companyId}`, {
        requiresAuth: true,
      })

      setEditingCompanyId(company.id)
      setCompanyErrors({})
      setCompanyForm({
        nome: company.nome ?? '',
        cnpj: company.cnpj ?? '',
        enderecoCompleto: company.enderecoCompleto ?? '',
        telefone: company.telefone ?? '',
        email: company.email ?? '',
        logo: company.logo ?? '',
      })
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Falha ao carregar empresa para edicao.')
    } finally {
      setLoadingCompanyActionId(null)
    }
  }

  async function startEditUser(userId: number) {
    setLoadingUserActionId(userId)
    setGlobalError('')
    try {
      const user = await apiRequest<Usuario>(`/usuario/${userId}`, {
        requiresAuth: true,
      })

      setEditingUserId(user.id)
      setUserErrors({})
      setUserForm({
        nome: user.nome ?? '',
        login: user.login ?? '',
        email: user.email ?? '',
        senha: '',
        empresa_id: user.empresa_id ? String(user.empresa_id) : '',
        funcoes: user.funcoes?.map((role) => role.id) ?? [],
      })
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Falha ao carregar usuario para edicao.')
    } finally {
      setLoadingUserActionId(null)
    }
  }

  async function deleteUser(id: number) {
    const confirmed = window.confirm('Confirma exclusao do usuario?')
    if (!confirmed) return

    setGlobalError('')
    setDeletingUserId(id)
    try {
      await apiRequest(`/usuario/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      })

      if (editingUserId === id) {
        resetUserForm()
      }

      setSuccessMessage('Usuario excluido com sucesso.')
      await loadUsers(userPage)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao excluir usuario.')
    } finally {
      setDeletingUserId(null)
    }
  }

  async function submitEventLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateEventLog(eventLogForm)
    setEventLogErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setIsSavingEventLog(true)
    setGlobalError('')

    try {
      await apiRequest('/api/v1/logEvento', {
        method: 'POST',
        requiresAuth: true,
        body: {
          ...eventLogForm,
          data_hora: new Date(eventLogForm.data_hora).toISOString(),
        },
      })

      setSuccessMessage('Evento registrado com sucesso.')
      setEventLogForm(emptyEventLog)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao registrar evento.')
    } finally {
      setIsSavingEventLog(false)
    }
  }

  async function retryIntegrationById() {
    const id = retryIntegrationId.trim()
    if (!id) {
      setGlobalError('Informe o ID da integração para retry.')
      return
    }

    setIsRetryingIntegration(true)
    setGlobalError('')

    try {
      await apiRequest(`/api/v1/monitoring/retry/${id}`, {
        method: 'POST',
        requiresAuth: true,
      })

      setSuccessMessage('Integração marcada para retry.')
      setRetryIntegrationId('')
      await loadIntegrationMonitoring()
      await loadIntegrationsList(integrationPage, integrationCriticaFilter, integrationOnlyErrors)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao solicitar retry.')
    } finally {
      setIsRetryingIntegration(false)
    }
  }

  async function applyIntegrationFilter() {
    setIntegrationPage(0)
    await loadIntegrationsList(0, integrationCriticaFilter, integrationOnlyErrors)
  }

  async function changeIntegrationPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalIntegrationPages) return
    setIntegrationPage(nextPage)
    await loadIntegrationsList(nextPage, integrationCriticaFilter, integrationOnlyErrors)
  }

  async function changeCompanyPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalCompanyPages) return
    setCompanyPage(nextPage)
    try {
      await loadCompanies(nextPage)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Falha na paginacao de empresas.')
    }
  }

  async function changeUserPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalUserPages) return
    setUserPage(nextPage)
    try {
      await loadUsers(nextPage)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Falha na paginacao de usuarios.')
    }
  }

  function toggleRole(roleId: number) {
    setUserForm((previous) => {
      const exists = previous.funcoes.includes(roleId)
      return {
        ...previous,
        funcoes: exists ? previous.funcoes.filter((id) => id !== roleId) : [...previous.funcoes, roleId],
      }
    })
  }

  return (
    <div className="app-shell">
      <div className={isBusy ? 'top-progress active' : 'top-progress'} aria-hidden="true">
        <span />
      </div>

      {toastMessage ? (
        <div className={`toast ${toastType}`} role="status" aria-live="polite">
          <p>{toastMessage}</p>
          <button
            type="button"
            className="toast-close"
            onClick={() => {
              setGlobalError('')
              setSuccessMessage('')
            }}
            aria-label="Fechar notificacao"
          >
            x
          </button>
        </div>
      ) : null}

      <header className="topbar">
        <div>
          <p className="eyebrow">Techlist API</p>
          <h1>Painel Administrativo</h1>
        </div>
        {token ? (
          <button type="button" className="btn ghost" onClick={logout}>
            Sair
          </button>
        ) : null}
      </header>

      <section className="status-grid">
        <article className="status-card">
          <h2>Conectividade da API</h2>
          <p className="status-value">{String(health?.status ?? '...')}</p>
          <p className="muted">Endpoint publico: /health</p>
        </article>
        <article className="status-card">
          <h2>Backend URL</h2>
          <p className="status-value small">{API_BASE_URL}</p>
          <p className="muted">Configure em VITE_API_BASE_URL</p>
        </article>
        <article className="status-card">
          <h2>Autenticacao</h2>
          <p className="status-value">{token ? 'Conectado' : 'Nao autenticado'}</p>
          <p className="muted">JWT via Authorization e x-access-token</p>
        </article>
      </section>

      {!token ? (
        <section className="panel login-panel">
          <h2>Entrar no admin</h2>
          <form onSubmit={(event) => void handleLogin(event)} className="form-grid two-columns">
            <label>
              Login
              <input
                value={loginForm.login}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, login: event.target.value }))}
                placeholder="admin"
                autoComplete="username"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={loginForm.senha}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, senha: event.target.value }))}
                placeholder="******"
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn" disabled={isAuthenticating}>
              {isAuthenticating ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          {authError ? <p className="error-text">{authError}</p> : null}
        </section>
      ) : (
        <>
          <nav className="tabs" aria-label="Navegacao principal">
            <button
              type="button"
              className={activeTab === 'overview' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('overview')}
            >
              Visao geral
            </button>
            <button
              type="button"
              className={activeTab === 'companies' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('companies')}
            >
              Empresas
            </button>
            <button
              type="button"
              className={activeTab === 'users' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('users')}
            >
              Usuarios
            </button>
            <button
              type="button"
              className={activeTab === 'integrations' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('integrations')}
            >
              Integrações
            </button>
          </nav>

          {isLoadingData ? <p className="muted">Carregando dados administrativos...</p> : null}

          {activeTab === 'overview' ? (
            <section className="panel">
              <h2>Resumo</h2>
              <div className="kpis">
                <article>
                  <p className="kpi-label">Empresas</p>
                  <p className="kpi-value">{companyCount}</p>
                </article>
                <article>
                  <p className="kpi-label">Usuarios</p>
                  <p className="kpi-value">{userCount}</p>
                </article>
                <article>
                  <p className="kpi-label">Funcoes</p>
                  <p className="kpi-value">{allRoles.length}</p>
                </article>
              </div>
            </section>
          ) : null}

          {activeTab === 'companies' ? (
            <section className="panel split">
              <div>
                <h2>{editingCompanyId ? 'Edicao de empresa' : 'Cadastro de empresa'}</h2>
                <form onSubmit={(event) => void submitCompany(event)} className="form-grid two-columns">
                  <label>
                    Nome *
                    <input
                      value={companyForm.nome}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, nome: event.target.value }))}
                    />
                    {companyErrors.nome ? <small>{companyErrors.nome}</small> : null}
                  </label>
                  <label>
                    CNPJ
                    <input
                      value={companyForm.cnpj}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                    />
                    {companyErrors.cnpj ? <small>{companyErrors.cnpj}</small> : null}
                  </label>
                  <label>
                    Email
                    <input
                      value={companyForm.email}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                    {companyErrors.email ? <small>{companyErrors.email}</small> : null}
                  </label>
                  <label>
                    Telefone
                    <input
                      value={companyForm.telefone}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, telefone: event.target.value }))}
                    />
                  </label>
                  <label className="full">
                    Endereco completo
                    <input
                      value={companyForm.enderecoCompleto}
                      onChange={(event) =>
                        setCompanyForm((prev) => ({ ...prev, enderecoCompleto: event.target.value }))
                      }
                    />
                  </label>
                  <label className="full">
                    Logo URL
                    <input
                      value={companyForm.logo}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, logo: event.target.value }))}
                    />
                  </label>
                  <button type="submit" className="btn" disabled={isSavingCompany}>
                    {isSavingCompany
                      ? 'Salvando...'
                      : editingCompanyId
                        ? 'Atualizar empresa'
                        : 'Salvar empresa'}
                  </button>
                  {editingCompanyId ? (
                    <button type="button" className="btn ghost" onClick={resetCompanyForm}>
                      Cancelar edicao
                    </button>
                  ) : null}
                </form>
              </div>

              <div>
                <h2>Empresas cadastradas</h2>
                <div className="table-toolbar">
                  <input
                    className="search-input"
                    value={companySearch}
                    onChange={(event) => setCompanySearch(event.target.value)}
                    placeholder="Buscar por nome, CNPJ, email ou telefone"
                    aria-label="Buscar empresas"
                  />
                  {companySearch ? (
                    <button type="button" className="btn ghost btn-inline" onClick={() => setCompanySearch('')}>
                      Limpar
                    </button>
                  ) : null}
                </div>
                <p className="muted table-hint">
                  Mostrando {filteredCompanies.length} de {companies.length} registros da pagina atual.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => (
                        <tr key={company.id}>
                          <td>{company.id}</td>
                          <td>{company.nome}</td>
                          <td>{company.email ?? '-'}</td>
                          <td>{company.telefone ?? '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost btn-inline"
                              onClick={() => void startEditCompany(company.id)}
                              disabled={loadingCompanyActionId === company.id}
                            >
                              {loadingCompanyActionId === company.id ? 'Carregando...' : 'Editar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pager">
                  <button type="button" className="btn ghost" onClick={() => void changeCompanyPage(companyPage - 1)}>
                    Anterior
                  </button>
                  <span>
                    Pagina {companyPage + 1} de {totalCompanyPages}
                  </span>
                  <button type="button" className="btn ghost" onClick={() => void changeCompanyPage(companyPage + 1)}>
                    Proxima
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === 'users' ? (
            <section className="panel split">
              <div>
                <h2>{editingUserId ? 'Edicao de usuario' : 'Cadastro de usuario'}</h2>
                <form onSubmit={(event) => void submitUser(event)} className="form-grid two-columns">
                  <label>
                    Nome *
                    <input
                      value={userForm.nome}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, nome: event.target.value }))}
                    />
                    {userErrors.nome ? <small>{userErrors.nome}</small> : null}
                  </label>
                  <label>
                    Login *
                    <input
                      value={userForm.login}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, login: event.target.value }))}
                    />
                    {userErrors.login ? <small>{userErrors.login}</small> : null}
                  </label>
                  <label>
                    Email *
                    <input
                      value={userForm.email}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                    {userErrors.email ? <small>{userErrors.email}</small> : null}
                  </label>
                  <label>
                    {editingUserId ? 'Nova senha *' : 'Senha *'}
                    <input
                      type="password"
                      value={userForm.senha}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, senha: event.target.value }))}
                    />
                    {userErrors.senha ? <small>{userErrors.senha}</small> : null}
                  </label>
                  <label className="full">
                    Empresa
                    <select
                      value={userForm.empresa_id}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, empresa_id: event.target.value }))}
                    >
                      <option value="">Sem empresa</option>
                      {allCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset className="full roles-box">
                    <legend>Funcoes *</legend>
                    {allRoles.map((role) => (
                      <label key={role.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={userForm.funcoes.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                        />
                        <span>{role.descricao}</span>
                      </label>
                    ))}
                    {userErrors.funcoes ? <small>{userErrors.funcoes}</small> : null}
                  </fieldset>

                  <button type="submit" className="btn" disabled={isSavingUser}>
                    {isSavingUser
                      ? 'Salvando...'
                      : editingUserId
                        ? 'Atualizar usuario'
                        : 'Salvar usuario'}
                  </button>
                  {editingUserId ? (
                    <button type="button" className="btn ghost" onClick={resetUserForm}>
                      Cancelar edicao
                    </button>
                  ) : null}
                </form>
              </div>

              <div>
                <h2>Usuarios cadastrados</h2>
                <div className="table-toolbar">
                  <input
                    className="search-input"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Buscar por nome, login, email, empresa ou funcao"
                    aria-label="Buscar usuarios"
                  />
                  {userSearch ? (
                    <button type="button" className="btn ghost btn-inline" onClick={() => setUserSearch('')}>
                      Limpar
                    </button>
                  ) : null}
                </div>
                <p className="muted table-hint">
                  Mostrando {filteredUsers.length} de {users.length} registros da pagina atual.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>Login</th>
                        <th>Email</th>
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.nome}</td>
                          <td>{user.login}</td>
                          <td>{user.email}</td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="btn ghost btn-inline"
                              onClick={() => void startEditUser(user.id)}
                              disabled={loadingUserActionId === user.id || deletingUserId === user.id}
                            >
                              {loadingUserActionId === user.id ? 'Carregando...' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              className="btn ghost danger btn-inline"
                              onClick={() => void deleteUser(user.id)}
                              disabled={deletingUserId === user.id || loadingUserActionId === user.id}
                            >
                              {deletingUserId === user.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pager">
                  <button type="button" className="btn ghost" onClick={() => void changeUserPage(userPage - 1)}>
                    Anterior
                  </button>
                  <span>
                    Pagina {userPage + 1} de {totalUserPages}
                  </span>
                  <button type="button" className="btn ghost" onClick={() => void changeUserPage(userPage + 1)}>
                    Proxima
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === 'integrations' ? (
            <section className="integration-grid">
              <article className="panel">
                <h2>Resumo de integrações</h2>
                <div className="kpis integrations-kpis">
                  <article>
                    <p className="kpi-label">Periodo</p>
                    <p className="kpi-value small">{integrationStats?.period ?? '7 dias'}</p>
                  </article>
                  <article>
                    <p className="kpi-label">Total</p>
                    <p className="kpi-value">{integrationStats?.totalIntegrations ?? 0}</p>
                  </article>
                  <article>
                    <p className="kpi-label">Sucesso</p>
                    <p className="kpi-value">{integrationStats?.successRate ?? 0}%</p>
                  </article>
                </div>

                <div className="table-wrap integration-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Qtd.</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrationStatusCards.map((item) => (
                        <tr key={item.status}>
                          <td>{item.status}</td>
                          <td>{item.count}</td>
                          <td>{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <h2>Falhas recentes de motorista</h2>
                <p className="muted table-hint">
                  Total: {integrationFailures?.totalFailures ?? 0} | CPFs únicos: {integrationFailures?.uniqueCpfCount ?? 0}
                </p>
                <div className="table-wrap integration-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>CPF</th>
                        <th>Status</th>
                        <th>Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(integrationFailures?.recentFailures ?? []).map((failure) => (
                        <tr key={failure.id}>
                          <td>{new Date(failure.date).toLocaleString('pt-BR')}</td>
                          <td>{failure.cpf ?? '-'}</td>
                          <td>{failure.status ?? '-'}</td>
                          <td>{failure.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <h2>Listagem da tabela integrações</h2>
                <div className="table-toolbar integration-filter-toolbar">
                  <input
                    className="search-input"
                    value={integrationCriticaFilter}
                    onChange={(event) => setIntegrationCriticaFilter(event.target.value)}
                    placeholder="Filtro rápido por critica_retorno"
                    aria-label="Filtro por critica retorno"
                  />
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={integrationOnlyErrors}
                      onChange={(event) => setIntegrationOnlyErrors(event.target.checked)}
                    />
                    Somente com erro
                  </label>
                  <button type="button" className="btn ghost btn-inline" onClick={() => void applyIntegrationFilter()}>
                    Filtrar
                  </button>
                </div>
                <p className="muted table-hint">
                  {isLoadingIntegrationRows
                    ? 'Carregando integrações...'
                    : `Mostrando ${integrationRows.length} registros da página ${integrationPage + 1}.`}
                </p>
                <div className="table-wrap integration-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Data registro</th>
                        <th>Status</th>
                        <th>Path</th>
                        <th>Crítica retorno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrationRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.data_registro ? new Date(row.data_registro).toLocaleString('pt-BR') : '-'}</td>
                          <td>{row.status ?? '-'}</td>
                          <td>{row.path ?? '-'}</td>
                          <td>{row.critica_retorno || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pager">
                  <button type="button" className="btn ghost" onClick={() => void changeIntegrationPage(integrationPage - 1)}>
                    Anterior
                  </button>
                  <span>
                    Página {integrationPage + 1} de {totalIntegrationPages}
                  </span>
                  <button type="button" className="btn ghost" onClick={() => void changeIntegrationPage(integrationPage + 1)}>
                    Próxima
                  </button>
                </div>
              </article>

              <article className="panel">
                <h2>Registrar log por evento</h2>
                <form onSubmit={(event) => void submitEventLog(event)} className="form-grid two-columns">
                  <label>
                    Data e hora
                    <input
                      type="datetime-local"
                      value={eventLogForm.data_hora}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, data_hora: event.target.value }))}
                    />
                    {eventLogErrors.data_hora ? <small>{eventLogErrors.data_hora}</small> : null}
                  </label>
                  <label>
                    Tipo do documento
                    <input
                      value={eventLogForm.tipo_documento}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, tipo_documento: event.target.value }))}
                    />
                    {eventLogErrors.tipo_documento ? <small>{eventLogErrors.tipo_documento}</small> : null}
                  </label>
                  <label>
                    UUID
                    <input
                      value={eventLogForm.UUID}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, UUID: event.target.value }))}
                    />
                    {eventLogErrors.UUID ? <small>{eventLogErrors.UUID}</small> : null}
                  </label>
                  <label>
                    CPF do usuário
                    <input
                      value={eventLogForm.cpf_user}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, cpf_user: event.target.value }))}
                    />
                    {eventLogErrors.cpf_user ? <small>{eventLogErrors.cpf_user}</small> : null}
                  </label>
                  <label>
                    Tipo do evento
                    <input
                      value={eventLogForm.tipo_evento}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, tipo_evento: event.target.value }))}
                    />
                    {eventLogErrors.tipo_evento ? <small>{eventLogErrors.tipo_evento}</small> : null}
                  </label>
                  <label>
                    Chave
                    <input
                      value={eventLogForm.chave}
                      onChange={(event) => setEventLogForm((prev) => ({ ...prev, chave: event.target.value }))}
                    />
                    {eventLogErrors.chave ? <small>{eventLogErrors.chave}</small> : null}
                  </label>
                  <button type="submit" className="btn" disabled={isSavingEventLog}>
                    {isSavingEventLog ? 'Registrando...' : 'Registrar evento'}
                  </button>
                </form>
              </article>

              <article className="panel">
                <h2>Retry manual de integração</h2>
                <div className="retry-box">
                  <input
                    value={retryIntegrationId}
                    onChange={(event) => setRetryIntegrationId(event.target.value)}
                    placeholder="ID da integração"
                    inputMode="numeric"
                  />
                  <button type="button" className="btn" onClick={() => void retryIntegrationById()} disabled={isRetryingIntegration}>
                    {isRetryingIntegration ? 'Enviando...' : 'Solicitar retry'}
                  </button>
                </div>
              </article>
            </section>
          ) : null}
        </>
      )}

      <footer className="footer-note">
        <p>
          Frontend administrativo conectado ao backend Techlist API. Endpoints com protecao exigem perfil
          ADMIN ou SUPER_ADMIN.
        </p>
      </footer>
    </div>
  )
}

export default App
