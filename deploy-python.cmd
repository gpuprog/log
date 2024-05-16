setlocal
cd %~dp0
erase /Q %~dp0\dist

python -m build
@if NOT %ERRORLEVEL%==0 goto error

python -m twine upload --repository pypi dist\*
@if NOT %ERRORLEVEL%==0 goto error

@exit /b 0
@goto exit

:error
@exit /b 1

:exit