import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTsrfRequestSchema, InsertTsrfRequest } from '../../src/db/validation';

export function TSRFFormExample({ onSubmit }: { onSubmit: (data: InsertTsrfRequest) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InsertTsrfRequest>({
    resolver: zodResolver(insertTsrfRequestSchema),
    defaultValues: {
      department: '',
      projectName: '',
      origin: '',
      destination: '',
      callTime: '08:00 AM',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="projectName" className="block text-sm font-medium">
          Project Name
        </label>
        <input
          id="projectName"
          {...register('projectName')}
          className="border rounded px-2 py-1 w-full"
        />
        {errors.projectName && (
          <span className="text-red-500 text-xs">{errors.projectName.message}</span>
        )}
      </div>

      <div>
        <label htmlFor="department" className="block text-sm font-medium">
          Department
        </label>
        <input
          id="department"
          {...register('department')}
          className="border rounded px-2 py-1 w-full"
        />
        {errors.department && (
          <span className="text-red-500 text-xs">{errors.department.message}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Submit TSRF
      </button>
    </form>
  );
}
