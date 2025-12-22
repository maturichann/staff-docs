export type UserRole = 'admin' | 'staff'

export interface Profile {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  file_name: string
  file_path: string
  staff_name: string
  staff_id: string | null
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

export interface Staff {
  id: string
  name: string
  email: string
  created_at: string
}
