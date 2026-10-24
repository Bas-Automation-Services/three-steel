# Third-party data

three-steel's code is MIT, © Bas Automation Services (see `LICENSE`). Its IPE, IPN, HEA, HEB, HEM,
UPN, UPE, UB, UC and PFC section dimensions are copied from the tables below. The original tables
are in `data/sources/` in the repository.

## Steel_Section_Database (IPE, IPN, HEA, HEB, HEM, UPN, UPE)

[ulmewix/Steel_Section_Database](https://github.com/ulmewix/Steel_Section_Database) by Adam Koudelka,
under the MIT licence:

```
MIT License

Copyright (c) 2026 Adam Koudelka

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Koyda steel section tables (UB, UC, PFC)

[Steel section tables](https://www.koyda.com/steel-section-tables/) by Koyda Ltd
([www.koyda.com](https://www.koyda.com)), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: the dimensional columns were
converted to TypeScript tables; for UB and UC the BS 4-1:2005 root radius is used where Koyda lists it.

Koyda publishes the tables as reference values: check them against current manufacturer data
before relying on them.
