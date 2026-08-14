import Swal from 'sweetalert2'

const commonOptions = {
  customClass: {
    popup: '!bg-[var(--card)] !border-[var(--border)] !border !rounded-2xl !text-[var(--foreground)]',
    title: '!text-[var(--foreground)] !text-xl !font-bold !tracking-tight',
    htmlContainer: '!text-[var(--muted-foreground)] !text-sm !font-medium',
    confirmButton: '!bg-[var(--primary)] !text-white !rounded-xl !px-6 !py-3 !font-bold !text-sm !uppercase !tracking-widest !border-0',
  },
  buttonsStyling: false,
  showConfirmButton: true,
  confirmButtonText: 'Okay',
  animation: false,
  showClass: {
    popup: 'animate-in zoom-in-95 duration-200 ease-out'
  },
  hideClass: {
    popup: 'animate-out zoom-out-95 duration-200 ease-in'
  }
}

const formatOptions = (options?: any) => {
  if (!options) return {}
  const { description, ...rest } = options
  if (description) {
    return {
      ...rest,
      html: `<div style="margin-top: 8px; font-size: 0.875rem; opacity: 0.85; font-weight: 500;">${description}</div>`
    }
  }
  return rest
}

export const toast = {
  success: (message: string, options?: any) => {
    Swal.fire({
      ...commonOptions,
      title: 'Success',
      text: message,
      icon: 'success',
      iconColor: 'var(--accent-success)',
      timer: 3000,
      timerProgressBar: true,
      ...formatOptions(options)
    })
  },
  error: (message: string, options?: any) => {
    Swal.fire({
      ...commonOptions,
      title: 'Error',
      text: message,
      icon: 'error',
      iconColor: 'var(--accent-danger)',
      ...formatOptions(options)
    })
  },
  info: (message: string, options?: any) => {
    Swal.fire({
      ...commonOptions,
      title: 'Info',
      text: message,
      icon: 'info',
      iconColor: 'var(--accent-info)',
      ...formatOptions(options)
    })
  },
  warning: (message: string, options?: any) => {
    Swal.fire({
      ...commonOptions,
      title: 'Warning',
      text: message,
      icon: 'warning',
      iconColor: 'var(--accent-primary)',
      ...formatOptions(options)
    })
  },
  loading: (message: string) => {
    Swal.fire({
      ...commonOptions,
      title: 'Please wait',
      text: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })
    return { close: () => Swal.close() }
  }
}
