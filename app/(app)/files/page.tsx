import { createClient } from '@/lib/supabase/server'
import FilesView from './files-view'

export default async function FilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id ?? ''

  const [{ data: files, error: fErr }, { data: folders, error: dErr }] = await Promise.all([
    supabase
      .from('files')
      .select('id,name,mime_type,file_size,updated_at,permission,owner_id,folder_id,storage_key')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('file_folders')
      .select('id,name,parent_id,is_company_folder,owner_id')
      .eq('organization_id', orgId)
      .order('name'),
  ])

  const listError = fErr?.message ?? dErr?.message ?? null

  return (
    <FilesView
      organizationId={orgId}
      userId={user!.id}
      initialFiles={(files ?? []) as never}
      initialFolders={(folders ?? []) as never}
      listError={listError}
    />
  )
}
