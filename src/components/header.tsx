import React from 'react';
import clsx from 'clsx';
// import { CloudflareLogo } from './icons/logos'; // Disabled for QFX Cloud App
import { Link } from 'react-router';

export function Header({
	className,
	children,
}: React.ComponentProps<'header'>) {
	return (
		<header
			className={clsx(
				'h-13 shrink-0 w-full px-4 border-b flex items-center',
				className,
			)}
		>
			<h1 className="flex items-center gap-2 mx-4">
				<Link to="/" className="flex items-center gap-2">
					<div className="h-4 w-4 bg-blue-600 rounded flex items-center justify-center">
						<span className="text-white text-xs font-bold">Q</span>
					</div>
					<span className="text-lg font-semibold text-gray-800">QFX Cloud App</span>
				</Link>
			</h1>
			<div className="flex-1"></div>
			<div className="flex items-center gap-4">
				{children}
			</div>
		</header>
	);
}
