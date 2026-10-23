# Math stress 数学压力测试

Inline dollar: $E = mc^2$, inline paren: \(a_1 + a_2 = b_{12}\), stars and underscores: $a*b*c$ and $x_1 x_2 x_3$.

Display dollar:

$$
\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}
$$

Display bracket:

\[
\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
\begin{bmatrix} x \\ y \end{bmatrix}
\]

\[
\begin{aligned}
(a+b)^2 &= a^2 + 2ab + b^2 \\
(a-b)^2 &= a^2 - 2ab + b^2
\end{aligned}
\]

$$
f(x) = \begin{cases} x^2, & x \ge 0 \\ -x, & x < 0 \end{cases}
$$

Nested fraction: \(\frac{1}{1+\frac{1}{1+\frac{1}{x}}}\) and \(\sqrt[3]{\frac{a^{2}}{b_{1}}}\).

Chinese in math: \(\text{面积} = \text{长} \times \text{宽}\)

Currency stays text: it costs $5 and $10 per month, or $ 20 total. Price is USD$30.

| Item | Formula | Price |
|:-----|:-------:|------:|
| Area | \(S=\pi r^2\) | $5 |
| Sum | $a+b$ | $10 |

1. First item with \(x^2\)
2. Second item with $$y=\frac{1}{2}$$ inline display
   - nested \(\alpha+\beta\)

> Quote with math \(\sqrt{2}\approx1.414\)
>
> \[
> e^{i\pi}+1=0
> \]

Inline code untouched: `\(not math\)` and `$PATH and $HOME` here.

```latex
\[ \frac{a}{b} \]  and \(x\) and $y$ stay literal in code
```

Broken formula: \(\frac{1}{\) should show an error, and the next one still works: \(z^2\).

Escaped dollar \$ is literal.
