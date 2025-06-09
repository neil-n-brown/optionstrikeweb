export default function LoadingSpinner({ size = 'md', message = null }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`${sizeClasses[size]} border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin`}></div>
      {message && (
        <p className="mt-3 text-sm text-corporate-600 text-center">{message}</p>
      )}
    </div>
  )
}