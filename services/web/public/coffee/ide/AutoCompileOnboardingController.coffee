define [
	"base"
], (App) ->
	App.controller "AutoCompileOnboardingController", ($scope) ->
		recompileBtn = angular.element('#recompile')
		popover = angular.element('.onboarding__autocompile')
		{ top, left } = recompileBtn.offset()

		# If pdf panel smaller than recompile button + popover, show to left.
		# Otherwise show to right
		if $scope.ui.pdfWidth < 475
			$scope.placement = 'left'
			popover.offset({
				top: top,
				left: left - popover.width()
			})
		else
			$scope.placement = 'right'
			angular.element('.onboarding__autocompile').offset({
				top: top,
				left: left + recompileBtn.width()
			})

		$scope.dismiss = () ->
			$scope.onboarding.autoCompile = 'dismissed'
			event_tracking.sendMB "shown-autocompile-onboarding"
