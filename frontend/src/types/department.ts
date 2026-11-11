export interface Department {
  id: number;
  department_code: string;
  name: string;
  description?: string | null;
  head_of_department_id?: number | null;
  is_active: boolean;
  employee_count?: number;
  head_of_department_name?: string | null;
  created_at: string;
  updated_at: string;
}

